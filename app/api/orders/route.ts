import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { db, orderStatements, orderItemStatements, userStatements, inventoryStatements } from "@/lib/database"
import type { OrderStatus, OrderWithItems, PrescriptionStatus } from "@/lib/types/orders"
import { ORDER_STATUS_SEQUENCE } from "@/lib/types/orders"
import { mapOrderRow, toNumber } from "@/lib/server/orders"

interface CreateOrderItemPayload {
  medicationId: number
  medicationName: string
  brand?: string
  quantity: number
  unitPrice: number
  finalPrice?: number
  insuranceSavings?: number
}

interface CreateOrderPayload {
  customerId: string
  pharmacyId: string
  pharmacyName: string
  deliveryAddress: string
  deliveryInstructions?: string | null
  paymentMethod: string
  insuranceUsed?: string | null
  prescriptionRequired?: boolean
  prescriptionUploaded?: boolean
  prescriptionStatus?: PrescriptionStatus
  prescriptionRejectionReason?: string | null
  prescriptionFileName?: string | null
  items: CreateOrderItemPayload[]
  deliveryFee: number
  estimatedDelivery?: string
}

const STATUS_PARAM_KEY = "status"

const ORDER_STATUS_SET = new Set<OrderStatus>(ORDER_STATUS_SEQUENCE)

const PRESCRIPTION_STORAGE_DIR = path.join(process.cwd(), "public", "recetas")
const MAX_PRESCRIPTION_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_PRESCRIPTION_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"])

const sanitizeFileBase = (input: string): string => {
  const normalized = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  const asciiOnly = normalized.replace(/[^\x00-\x7F]/g, "")
  const slug = asciiOnly.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return slug.toLowerCase().slice(0, 50)
}

const buildStoredFileName = (orderId: string, originalName: string): string => {
  const parsed = path.parse(originalName)
  const baseName = sanitizeFileBase(parsed.name) || "receta"
  const extension = parsed.ext.toLowerCase()
  const timestamp = Date.now()
  return `${orderId}-${timestamp}-${baseName}${extension}`
}

interface SavedPrescriptionFile {
  originalName: string
  relativePath: string
  absolutePath: string
}

const persistPrescriptionFile = async (orderId: string, file: File): Promise<SavedPrescriptionFile> => {
  await fs.mkdir(PRESCRIPTION_STORAGE_DIR, { recursive: true })
  const storedName = buildStoredFileName(orderId, file.name)
  const absolutePath = path.join(PRESCRIPTION_STORAGE_DIR, storedName)
  const arrayBuffer = await file.arrayBuffer()
  await fs.writeFile(absolutePath, Buffer.from(arrayBuffer))
  const relativePath = path.join("recetas", storedName).replace(/\\/g, "/")
  return {
    originalName: file.name,
    relativePath,
    absolutePath,
  }
}

const getOrdersByFilters = (params: URLSearchParams): OrderWithItems[] => {
  const customerId = params.get("customerId")
  const pharmacyId = params.get("pharmacyId")
  const courierId = params.get("courierId")
  const availableForCouriers = params.get("availableForCouriers") === "true"

  let rows: any[] = []

  if (availableForCouriers) {
    rows = orderStatements.getAvailableForCouriers.all()
  } else if (customerId) {
    rows = orderStatements.getByCustomerId.all(customerId)
  } else if (pharmacyId) {
    rows = orderStatements.getByPharmacyId.all(pharmacyId)
  } else if (courierId) {
    rows = orderStatements.getByCourierId.all(courierId)
  } else {
    rows = orderStatements.getAll.all()
  }

  const statusFilters = params
    .getAll(STATUS_PARAM_KEY)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => ORDER_STATUS_SET.has(value as OrderStatus)) as OrderStatus[]

  const filteredRows = statusFilters.length > 0 ? rows.filter((row) => statusFilters.includes(row.status)) : rows

  return filteredRows.map(mapOrderRow)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orders = getOrdersByFilters(searchParams)
    return NextResponse.json(orders)
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json({ error: "Error al obtener los pedidos" }, { status: 500 })
  }
}

const buildOrderNumber = () => {
  const timestamp = Date.now()
  const randomSuffix = Math.floor(Math.random() * 1000)
  return `PED-${timestamp}-${randomSuffix}`
}

export async function POST(request: NextRequest) {
  let savedFileAbsolutePath: string | null = null
  try {
    const formData = await request.formData()
    const payloadRaw = formData.get("payload")
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ error: "Datos del pedido inválidos" }, { status: 400 })
    }

    let body: Partial<CreateOrderPayload>
    try {
      body = JSON.parse(payloadRaw) as Partial<CreateOrderPayload>
    } catch {
      return NextResponse.json({ error: "Formato de datos inválido" }, { status: 400 })
    }

    if (!body?.customerId || !body.pharmacyId || !body.pharmacyName) {
      return NextResponse.json({ error: "Datos obligatorios incompletos" }, { status: 400 })
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "El pedido debe incluir al menos un medicamento" }, { status: 400 })
    }

    if (!body.deliveryAddress || !body.paymentMethod) {
      return NextResponse.json({ error: "Faltan datos de entrega o pago" }, { status: 400 })
    }

    const customer = userStatements.getById.get(body.customerId) as any
    if (!customer) {
      return NextResponse.json({ error: "El cliente no existe" }, { status: 400 })
    }

    const pharmacy = userStatements.getById.get(body.pharmacyId) as any
    if (!pharmacy || pharmacy.role !== "Farmacia") {
      return NextResponse.json({ error: "La farmacia no es válida" }, { status: 400 })
    }

    const fileEntry = formData.get("prescriptionFile")
    const prescriptionFile = fileEntry instanceof File ? fileEntry : null

    const prescriptionRequired = Boolean(body.prescriptionRequired)
    if (prescriptionRequired && !prescriptionFile) {
      return NextResponse.json({ error: "La receta médica es obligatoria" }, { status: 400 })
    }

    if (prescriptionFile) {
      if (!ALLOWED_PRESCRIPTION_MIME_TYPES.has(prescriptionFile.type)) {
        return NextResponse.json({ error: "Formato de archivo no permitido" }, { status: 400 })
      }
      if (prescriptionFile.size > MAX_PRESCRIPTION_FILE_SIZE) {
        return NextResponse.json({ error: "El archivo supera el tamaño máximo permitido" }, { status: 400 })
      }
    }

    const now = new Date().toISOString()
    const orderId = randomUUID()
    const orderNumber = buildOrderNumber()

    const normalizedItems = body.items.map((item) => {
      const quantity = Math.max(1, toNumber(item.quantity))
      const unitPrice = toNumber(item.unitPrice)
      const finalPrice = item.finalPrice !== undefined ? toNumber(item.finalPrice) : unitPrice * quantity
      const totalPrice = unitPrice * quantity
      const insuranceSavings = item.insuranceSavings !== undefined ? toNumber(item.insuranceSavings) : totalPrice - finalPrice
      return {
        medicationId: Number(item.medicationId),
        medicationName: item.medicationName,
        brand: item.brand ?? "",
        quantity,
        unitPrice,
        finalPrice,
        totalPrice,
        insuranceSavings: Math.max(0, insuranceSavings),
      }
    })

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.finalPrice, 0)
    const deliveryFee = Math.max(0, toNumber(body.deliveryFee))
    const insuranceDiscount = normalizedItems.reduce((sum, item) => sum + item.insuranceSavings, 0)
    const total = subtotal + deliveryFee

    const estimatedDelivery = body.estimatedDelivery ?? new Date(Date.now() + 45 * 60 * 1000).toISOString()
    const prescriptionStatus: PrescriptionStatus = body.prescriptionStatus ?? "pending"

    let originalFileName = body.prescriptionFileName ?? null
    let relativeFilePath: string | null = null

    if (prescriptionFile) {
      const persisted = await persistPrescriptionFile(orderId, prescriptionFile)
      savedFileAbsolutePath = persisted.absolutePath
      originalFileName = persisted.originalName
      relativeFilePath = persisted.relativePath
    }

    const prescriptionUploaded = Boolean(prescriptionFile ?? body.prescriptionUploaded)

    // Validate stock for all items before creating order
    for (const item of normalizedItems) {
      const invRow = db.prepare('SELECT * FROM inventory WHERE pharmacyId = ? AND medicationId = ?').get(body.pharmacyId, item.medicationId)
      const available = invRow ? Number(invRow.stock) : 0
      if (available < item.quantity) {
        return NextResponse.json({ error: 'Stock insuficiente', medicationId: item.medicationId, medicationName: item.medicationName, available }, { status: 400 })
      }
    }

    // Use a transaction: create order + items + update inventory atomically
    const createOrderTx = db.transaction(() => {
      orderStatements.insert.run(
        orderId,
        orderNumber,
        now,
        "processing",
        body.customerId,
        body.pharmacyId,
        body.pharmacyName,
        null,
        subtotal,
        deliveryFee,
        insuranceDiscount,
        total,
        body.deliveryAddress,
        body.deliveryInstructions ?? null,
        prescriptionRequired ? 1 : 0,
        prescriptionUploaded ? 1 : 0,
        prescriptionStatus,
        body.prescriptionRejectionReason ?? null,
        originalFileName,
        relativeFilePath,
        estimatedDelivery,
        null,
        body.paymentMethod,
        body.insuranceUsed ?? "",
        now,
        now,
      )

      // For each item, insert order item and decrement inventory for that pharmacy
      normalizedItems.forEach((item) => {
        orderItemStatements.insert.run(
          orderId,
          item.medicationId,
          item.medicationName,
          item.brand,
          item.quantity,
          item.unitPrice,
          item.totalPrice,
          item.finalPrice,
          item.insuranceSavings,
        )

        // Update inventory: try to find existing entry for this pharmacy+medication
        const invRow = db.prepare('SELECT * FROM inventory WHERE pharmacyId = ? AND medicationId = ?').get(body.pharmacyId, item.medicationId)
        if (invRow) {
          const newStock = invRow.stock - item.quantity
          inventoryStatements.update.run(invRow.precio ?? item.unitPrice, newStock, now, body.pharmacyId, item.medicationId)
        } else {
          // If no inventory record exists, insert one with negative stock to reflect reserved quantity
          // This helps track demand even if initial stock wasn't seeded.
          inventoryStatements.insert.run(body.pharmacyId, item.medicationId, item.unitPrice, -item.quantity, now)
        }
      })
    })

    createOrderTx()

    const createdOrderRow = orderStatements.getById.get(orderId)
    const createdOrder = createdOrderRow ? mapOrderRow(createdOrderRow) : null

    return NextResponse.json(createdOrder, { status: 201 })
  } catch (error) {
    if (savedFileAbsolutePath) {
      await fs.unlink(savedFileAbsolutePath).catch(() => undefined)
    }
    console.error("Error creating order:", error)
    return NextResponse.json({ error: "Error al crear el pedido" }, { status: 500 })
  }
}
