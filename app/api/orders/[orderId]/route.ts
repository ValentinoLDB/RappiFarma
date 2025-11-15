import { NextRequest, NextResponse } from "next/server"
import { db, orderStatements, orderItemStatements, inventoryStatements } from "@/lib/database"
import { mapOrderRow } from "@/lib/server/orders"
import type { OrderStatus } from "@/lib/types/orders"
import { isOrderStatus } from "@/lib/types/orders"

interface UpdateOrderPayload {
  status?: string
  pharmacyId?: string
  courierId?: string
  estimatedDelivery?: string
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  processing: ["accepted", "cancelled"],
  accepted: ["delivering", "cancelled"],
  delivering: ["delivered"],
  delivered: [],
  cancelled: [],
}

export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params
    const existingRow = orderStatements.getById.get(orderId)

    if (!existingRow) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const currentOrder = mapOrderRow(existingRow)

    const body = (await request.json()) as UpdateOrderPayload

    if (!body?.status || !isOrderStatus(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }

  const currentStatus = currentOrder.status
    const nextStatus = body.status as OrderStatus

    if (currentStatus === nextStatus) {
      const unchangedOrder = mapOrderRow(existingRow)
      return NextResponse.json(unchangedOrder)
    }

    const allowedTransitions = ORDER_TRANSITIONS[currentStatus] ?? []
    if (!allowedTransitions.includes(nextStatus)) {
      return NextResponse.json({ error: "Transición de estado no permitida" }, { status: 409 })
    }

    if ((nextStatus === "accepted" || nextStatus === "cancelled") && body.pharmacyId !== currentOrder.pharmacyId) {
      return NextResponse.json({ error: "La farmacia no coincide con el pedido" }, { status: 403 })
    }

    let updatedCourierId: string | null = currentOrder.courierId ?? null

    if (nextStatus === "delivering") {
      if (!body.courierId) {
        return NextResponse.json({ error: "El repartidor es obligatorio" }, { status: 400 })
      }
      if (currentStatus !== "accepted") {
        return NextResponse.json({ error: "El pedido no está disponible para repartidores" }, { status: 409 })
      }
      if (currentOrder.courierId && currentOrder.courierId !== body.courierId) {
        return NextResponse.json({ error: "El pedido ya fue tomado por otro repartidor" }, { status: 409 })
      }
      updatedCourierId = body.courierId
    }

    if (nextStatus === "delivered") {
      if (!body.courierId) {
        return NextResponse.json({ error: "El repartidor es obligatorio" }, { status: 400 })
      }
      if (!currentOrder.courierId || currentOrder.courierId !== body.courierId) {
        return NextResponse.json({ error: "Solo el repartidor asignado puede cerrar el pedido" }, { status: 403 })
      }
      updatedCourierId = currentOrder.courierId
    }

    if (nextStatus === "accepted" || nextStatus === "cancelled") {
      updatedCourierId = null
    }

    const now = new Date().toISOString()
    const actualDelivery = nextStatus === "delivered" ? now : null
    const estimatedDelivery = body.estimatedDelivery ?? null

    orderStatements.updateLifecycle.run(
      nextStatus,
      updatedCourierId,
      estimatedDelivery,
      actualDelivery,
      now,
      orderId,
    )

    // If the order was cancelled, restore inventory quantities for the items
    if (nextStatus === "cancelled") {
      try {
        const restoreTx = db.transaction(() => {
          const items = orderItemStatements.getByOrderId.all(orderId)
          items.forEach((item: any) => {
            const invRow = db.prepare('SELECT * FROM inventory WHERE pharmacyId = ? AND medicationId = ?').get(currentOrder.pharmacyId, item.medicationId)
            if (invRow) {
              const newStock = invRow.stock + item.quantity
              inventoryStatements.update.run(invRow.precio ?? 0, newStock, now, currentOrder.pharmacyId, item.medicationId)
            } else {
              // If no inventory record exists, insert a new one with the restored quantity
              inventoryStatements.insert.run(currentOrder.pharmacyId, item.medicationId, 0, item.quantity, now)
            }
          })
        })
        restoreTx()
      } catch (invErr) {
        console.error('Error restoring inventory for cancelled order', invErr)
      }
    }

  const updatedRow = orderStatements.getById.get(orderId)
  const updatedOrder = updatedRow ? mapOrderRow(updatedRow) : null

  return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("Error updating order:", error)
    return NextResponse.json({ error: "Error al actualizar el pedido" }, { status: 500 })
  }
}
