import { NextRequest, NextResponse } from 'next/server'
import { medicationStatements, medicationPriceStatements, inventoryStatements } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pharmacyId = searchParams.get('pharmacyId')
    const medicationIdParam = searchParams.get('medicationId')

    if (pharmacyId) {
      // Get medications available in this pharmacy using inventory table
      const inventoryItems = inventoryStatements.getInventoryWithDetails.all(pharmacyId)
      const pharmacyMeds = inventoryItems.map((item: any) => ({
        ...item,
        id: item.medicationId,
        price: item.precio,
        inStock: item.stock > 0,
        pharmacyPriceId: item.id,
      }))
      return NextResponse.json(pharmacyMeds)
    } else {
      const inventoryItems = inventoryStatements.getAllWithDetails.all()

      const medicationsMap = new Map<number, any>()

      for (const item of inventoryItems) {
        if (medicationIdParam && Number.parseInt(medicationIdParam, 10) !== item.medicationId) {
          continue
        }

        const medicationId = item.medicationId
        if (!medicationsMap.has(medicationId)) {
          medicationsMap.set(medicationId, {
            id: medicationId,
            name: item.name,
            genericName: item.genericName,
            brand: item.brand,
            category: item.category,
            requiresPrescription: Boolean(item.requiresPrescription),
            description: item.description,
            dosage: item.dosage,
            presentation: item.presentation,
            activeIngredient: item.activeIngredient,
            laboratory: item.laboratory,
            prices: [] as any[],
          })
        }

        const medicationEntry = medicationsMap.get(medicationId)
        const slugCandidate = typeof item.pharmacyId === 'string' && item.pharmacyId.startsWith('farmacia-')
          ? item.pharmacyId.replace('farmacia-', '')
          : item.pharmacyId
        const pharmacySlug = item.pharmacyRecordId || slugCandidate

        medicationEntry.prices.push({
          pharmacyId: item.pharmacyId,
          pharmacySlug,
          pharmacyName: item.pharmacyName || pharmacySlug,
          price: item.precio,
          discountedPrice: null,
          stock: item.stock,
          inStock: item.stock > 0,
          lastUpdated: item.lastUpdated,
          rating: item.pharmacyRating ?? null,
          deliveryFee: item.deliveryFee ?? null,
          deliveryTime: item.deliveryTime ?? null,
          isOpen: item.pharmacyIsOpen != null ? Boolean(item.pharmacyIsOpen) : null,
          minOrder: item.minOrder ?? null,
          address: item.pharmacyAddress ?? null,
          phone: item.pharmacyPhone ?? null,
          logo: item.pharmacyLogo ?? null,
        })
      }

      // Filter out price entries with stock <= 0 so clients don't see out-of-stock options
      const medications = Array.from(medicationsMap.values())
        .map((medication) => ({
          ...medication,
          prices: medication.prices.filter((p: any) => Number(p.stock) > 0).sort((a: any, b: any) => a.price - b.price),
        }))
        // Remove medications that have no available prices (all stock 0)
        .filter((medication) => medication.prices.length > 0)

      if (medicationIdParam) {
        if (medications.length === 0) {
          return NextResponse.json({ error: 'Medicamento no encontrado' }, { status: 404 })
        }
        return NextResponse.json(medications[0])
      }

      return NextResponse.json(medications)
    }
  } catch (error) {
    console.error('Error fetching medications:', error)
    return NextResponse.json(
      { error: 'Error fetching medications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      // For adding new medication to catalog
      name,
      genericName,
      brand,
      category,
      requiresPrescription,
      description,
      dosage,
      presentation,
      activeIngredient,
      laboratory,
      price,
      discountedPrice,
      inStock,
      pharmacyId,
      // For adding existing medication to pharmacy inventory
      medicationId,
    } = body

    // If medicationId is provided, add existing medication to pharmacy inventory
    if (medicationId) {
      // Validate required fields
      if (!pharmacyId || price === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: pharmacyId, price' },
          { status: 400 }
        )
      }

      // Check if medication exists
      const medication = medicationStatements.getById.get(medicationId)
      if (!medication) {
        return NextResponse.json(
          { error: 'Medication not found' },
          { status: 404 }
        )
      }

      // Check if already exists in inventory
      const existingInventory = inventoryStatements.getByPharmacyId.all(pharmacyId)
      const existingItem = existingInventory.find((item: any) => item.medicationId === medicationId)

      if (existingItem) {
        return NextResponse.json(
          { error: 'Medication already exists in this pharmacy inventory' },
          { status: 400 }
        )
      }

      // Insert into inventory
      inventoryStatements.insert.run(
        pharmacyId,
        medicationId,
        price,
        inStock !== undefined ? inStock : 10, // Default stock
        new Date().toISOString()
      )

      return NextResponse.json({
        success: true,
        message: 'Medication added to pharmacy inventory',
        medication: {
          ...medication,
          price,
          stock: inStock !== undefined ? inStock : 10,
          inStock: (inStock !== undefined ? inStock : 10) > 0,
        }
      })
    }

    // If no medicationId, create new medication and add to pharmacy inventory
    if (!name || !price || !pharmacyId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, pharmacyId' },
        { status: 400 }
      )
    }

    // Insert medication (id will auto-increment)
    const insertResult = medicationStatements.insert.run(
      null, // id will auto-increment
      name,
      genericName || '',
      brand || '',
      category || 'Otros',
      requiresPrescription ? 1 : 0,
      description || '',
      dosage || '',
      presentation || '',
      activeIngredient || '',
      laboratory || '',
      price
    )

    // Get the inserted medication id
    const newMedicationId = insertResult.lastInsertRowid

    // Add to pharmacy inventory
    inventoryStatements.insert.run(
      pharmacyId,
      newMedicationId,
      price,
      inStock !== undefined ? inStock : 10, // Default stock
      new Date().toISOString()
    )

    return NextResponse.json({
      success: true,
      message: 'Medication created and added to pharmacy inventory',
      medication: {
        id: newMedicationId,
        name,
        genericName,
        brand,
        category,
        requiresPrescription,
        description,
        dosage,
        presentation,
        activeIngredient,
        laboratory,
        price,
        discountedPrice,
        stock: inStock !== undefined ? inStock : 10,
        inStock: (inStock !== undefined ? inStock : 10) > 0,
      }
    })
  } catch (error) {
    console.error('Error creating medication:', error)
    return NextResponse.json(
      { error: 'Error creating medication' },
      { status: 500 }
    )
  }
}
