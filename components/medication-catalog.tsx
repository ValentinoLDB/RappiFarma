"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Filter } from "lucide-react"
import { MedicationCardWithPharmacies } from "./medication-card-with-pharmacies"
import { AdvancedFilters, type FilterState } from "./advanced-filters"
import type { ClientMedication, ClientMedicationPrice } from "@/lib/types/client-medication"

const fallbackCategories = ["Antibioticos", "Cardiovasculares", "Antidiabeticos", "Gastroenterologia", "Endocrinologia"]

const createDefaultFilters = (): FilterState => ({
  maxPrice: 10000,
})

export function MedicationCatalog() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Todos")
  const [sortBy, setSortBy] = useState("name")
  const [userInsurance, setUserInsurance] = useState<string>("")
  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters())
  const [medications, setMedications] = useState<ClientMedication[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      return
    }
    try {
      const userData = JSON.parse(storedUser)
      setUserInsurance(userData.obraSocial || "")
    } catch (error) {
      console.error("Error parsing stored user:", error)
    }
  }, [])

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoadingData(true)
      setLoadError(null)

      try {
        const response = await fetch("/api/medications")
        if (!response.ok) {
          throw new Error(`Estado inesperado: ${response.status}`)
        }

        const data = (await response.json()) as ClientMedication[]
        setMedications(data)
      } catch (error) {
        console.error("Error loading medication catalog:", error)
        setLoadError(error instanceof Error ? error.message : "Error desconocido al cargar el catalogo")
        setMedications([])
      } finally {
        setLoadingData(false)
      }
    }

    void fetchCatalog()
  }, [])

  const categoryOptions = useMemo(() => {
    const uniqueCategories = new Set<string>()
    medications.forEach((medication) => {
      if (medication.category) {
        uniqueCategories.add(medication.category)
      }
    })

    const dynamicCategories = Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b))
    const baseCategories = dynamicCategories.length > 0 ? dynamicCategories : fallbackCategories
    return ["Todos", ...baseCategories]
  }, [medications])

  const filteredMedications = useMemo(() => {
    const results: Array<{ medication: ClientMedication; minAvailablePrice: number }> = []
    const normalizedSearch = searchTerm.trim().toLowerCase()

    medications.forEach((medication) => {
      const matchesCategory = selectedCategory === "Todos" || medication.category === selectedCategory
      if (!matchesCategory) return

      const matchesSearch =
        normalizedSearch.length === 0 ||
        [medication.name, medication.genericName, medication.brand].some((field) =>
          field.toLowerCase().includes(normalizedSearch),
        )
      if (!matchesSearch) return

      const minAvailablePrice = medication.prices.reduce((best, price) => {
        const effectivePrice = price.discountedPrice ?? price.price
        return effectivePrice < best ? effectivePrice : best
      }, Number.POSITIVE_INFINITY)

      if (!Number.isFinite(minAvailablePrice) || minAvailablePrice > filters.maxPrice) return

      results.push({ medication, minAvailablePrice })
    })

    const sorted = results.sort((a, b) => {
      switch (sortBy) {
        case "price":
          return a.minAvailablePrice - b.minAvailablePrice
        case "category":
          return a.medication.category.localeCompare(b.medication.category)
        default:
          return a.medication.name.localeCompare(b.medication.name)
      }
    })

    return sorted.map((entry) => entry.medication)
  }, [medications, selectedCategory, searchTerm, filters.maxPrice, sortBy])

  const groupedMedications = useMemo(() => {
    const groups = new Map<
      string,
      {
        medication: ClientMedication
        priceKeys: Set<string>
      }
    >()

    const createPriceKey = (price: ClientMedicationPrice) => {
      const pharmacyId = (price.pharmacyId ?? "").toLowerCase()
      const pharmacySlug = (price.pharmacySlug ?? "").toLowerCase()
      const basePrice = Number.isFinite(price.price) ? price.price : 0
      const discounted = price.discountedPrice ?? null
      return `${pharmacyId}::${pharmacySlug}::${basePrice}::${discounted ?? "null"}`
    }

    filteredMedications.forEach((medication) => {
      const normalizedName = medication.name.trim().toLowerCase()
      const normalizedCategory = medication.category.trim().toLowerCase()
      const groupKey = `${normalizedName}::${normalizedCategory}`
      const existing = groups.get(groupKey)

      if (!existing) {
        const priceKeys = new Set<string>()
        const dedupedPrices: ClientMedicationPrice[] = []

        medication.prices.forEach((price) => {
          const key = createPriceKey(price)
          if (!priceKeys.has(key)) {
            priceKeys.add(key)
            dedupedPrices.push(price)
          }
        })

        groups.set(groupKey, {
          medication: { ...medication, prices: dedupedPrices },
          priceKeys,
        })
        return
      }

      const dedupedPrices = [...existing.medication.prices]
      medication.prices.forEach((price) => {
        const key = createPriceKey(price)
        if (!existing.priceKeys.has(key)) {
          existing.priceKeys.add(key)
          dedupedPrices.push(price)
        }
      })

      existing.medication = {
        ...existing.medication,
        prices: dedupedPrices,
      }
    })

    return Array.from(groups.values()).map((entry) => entry.medication)
  }, [filteredMedications])

  const activeFiltersCount = useMemo(() => {
    return filters.maxPrice < 10000 ? 1 : 0
  }, [filters.maxPrice])

  const handleResetFilters = () => {
    setSearchTerm("")
    setSelectedCategory("Todos")
    setFilters(createDefaultFilters())
  }

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Comparador de Precios</h2>
          <p className="text-muted-foreground text-lg">
            Compara precios en multiples farmacias y encuentra el mejor precio con tu obra social
          </p>
          {/* Mensaje de obra social removido: los precios ya no dependen de la obra social */}
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 transform text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar medicamento..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="price">Mejor precio</SelectItem>
                <SelectItem value="category">Categoria</SelectItem>
              </SelectContent>
            </Select>

            <AdvancedFilters onFiltersChange={setFilters} currentFilters={filters} pharmacies={[]} />
          </div>

          {activeFiltersCount > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>
                  {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} activo
                  {activeFiltersCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6">
          {loadingData ? (
            <p className="text-muted-foreground">Cargando medicamentos...</p>
          ) : loadError ? (
            <p className="text-destructive">No se pudo cargar el catalogo: {loadError}</p>
          ) : (
            <p className="text-muted-foreground">Mostrando {groupedMedications.length} medicamentos</p>
          )}
        </div>

        {loadingData ? (
          <div className="text-center py-12 text-muted-foreground">Cargando catalogo...</div>
        ) : loadError ? (
          <div className="text-center py-12">
            <p className="text-destructive text-lg mb-4">No se pudo cargar el catalogo de medicamentos.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </div>
        ) : groupedMedications.length > 0 ? (
          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
            {groupedMedications.map((medication) => (
              <MedicationCardWithPharmacies key={medication.id} medication={medication} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              No se encontraron medicamentos que coincidan con tu busqueda y filtros
            </p>
            <Button variant="secondary" className="mt-4" onClick={handleResetFilters}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}