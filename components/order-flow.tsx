"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  MapPin,
  Clock,
  Truck,
  Star,
  CheckCircle,
  AlertCircle,
  Package,
  FileText,
  Phone,
  CreditCard,
} from "lucide-react"
import { pharmacies, type Pharmacy } from "@/lib/data/pharmacies"
import type { MedicationMultiPharmacy } from "@/lib/data/medications-multi-pharmacy"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"

interface OrderFlowProps {
  medication: MedicationMultiPharmacy
}

export function OrderFlow({ medication }: OrderFlowProps) {
  const [step, setStep] = useState<"select-pharmacy" | "order-details">("select-pharmacy")
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null)
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null)
  const [orderDetails, setOrderDetails] = useState({
    quantity: 1,
    deliveryAddress: "",
    deliveryInstructions: "",
    contactPhone: "",
    paymentMethod: "efectivo",
  })

  // Filtrar farmacias que tienen el medicamento en stock
  const availablePharmacies = pharmacies.filter((pharmacy) => {
    const priceInfo = medication.prices.find((p) => p.pharmacyId === pharmacy.id)
    return priceInfo?.inStock
  })

  const handlePharmacySelect = (pharmacy: Pharmacy) => {
    setSelectedPharmacy(pharmacy)
    setStep("order-details")
  }

  const handlePrescriptionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar formato
    const validFormats = ["image/jpeg", "image/png", "application/pdf"]
    if (!validFormats.includes(file.type)) {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos JPG, PNG o PDF",
        variant: "destructive",
      })
      return
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El archivo no debe superar los 10MB",
        variant: "destructive",
      })
      return
    }

    setPrescriptionFile(file)
    toast({
      title: "Receta cargada",
      description: "La receta será validada por la farmacia",
    })
  }

  const handleSubmitOrder = () => {
    if (!prescriptionFile) {
      toast({
        title: "Receta requerida",
        description: "Debes cargar una receta médica para continuar",
        variant: "destructive",
      })
      return
    }

    if (!orderDetails.deliveryAddress || !orderDetails.contactPhone) {
      toast({
        title: "Datos incompletos",
        description: "Completa todos los campos requeridos",
        variant: "destructive",
      })
      return
    }

    // Simular creación de pedido
    toast({
      title: "Pedido creado",
      description: "Tu pedido está siendo procesado. La farmacia validará tu receta.",
    })

    // Aquí iría la lógica para crear el pedido en la base de datos
  }

  const getPharmacyPrice = (pharmacyId: string) => {
    const priceInfo = medication.prices.find((p) => p.pharmacyId === pharmacyId)
    return priceInfo?.discountedPrice || priceInfo?.price || 0
  }

  if (step === "select-pharmacy") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Selecciona una farmacia</h2>
          <p className="text-muted-foreground">
            {availablePharmacies.length} farmacias tienen {medication.name} disponible
          </p>
        </div>

        {availablePharmacies.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Lo sentimos, este medicamento no está disponible en ninguna farmacia en este momento.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4">
            {availablePharmacies.map((pharmacy) => {
              const price = getPharmacyPrice(pharmacy.id)
              const priceInfo = medication.prices.find((p) => p.pharmacyId === pharmacy.id)

              return (
                <Card
                  key={pharmacy.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handlePharmacySelect(pharmacy)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <Image
                          src={pharmacy.logo || "/placeholder.svg"}
                          alt={pharmacy.name}
                          width={60}
                          height={60}
                          className="rounded-lg border"
                        />
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{pharmacy.name}</h3>
                            {pharmacy.isOnGuard && (
                              <Badge variant="destructive" className="text-xs">
                                De Guardia
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-secondary text-secondary" />
                              <span>{pharmacy.rating}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{pharmacy.deliveryTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Truck className="h-4 w-4" />
                              <span>${pharmacy.deliveryFee}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{pharmacy.address}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{pharmacy.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-2xl font-bold text-primary">${price.toLocaleString()}</div>
                        {priceInfo?.discountedPrice && (
                          <div className="text-sm text-muted-foreground line-through">
                            ${priceInfo.price.toLocaleString()}
                          </div>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          En stock
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Step 2: Order Details
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setStep("select-pharmacy")}>
          ← Volver
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Detalles del pedido</h2>
          <p className="text-muted-foreground">Completa la información para realizar tu pedido</p>
        </div>
      </div>

      {selectedPharmacy && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Resumen del pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{medication.name}</p>
                <p className="text-sm text-muted-foreground">{medication.presentation}</p>
              </div>
              <p className="font-bold text-lg">${getPharmacyPrice(selectedPharmacy.id).toLocaleString()}</p>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-3">
                <Image
                  src={selectedPharmacy.logo || "/placeholder.svg"}
                  alt={selectedPharmacy.name}
                  width={40}
                  height={40}
                  className="rounded"
                />
                <div>
                  <p className="font-semibold">{selectedPharmacy.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPharmacy.address}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receta médica
          </CardTitle>
          <CardDescription>La farmacia validará tu receta antes de procesar el pedido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prescription">Cargar receta (JPG, PNG o PDF - máx 10MB)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="prescription"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handlePrescriptionUpload}
                className="flex-1"
              />
              {prescriptionFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{prescriptionFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {!prescriptionFile && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Es obligatorio cargar una receta médica para medicamentos con prescripción
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Información de entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={orderDetails.quantity}
              onChange={(e) => setOrderDetails({ ...orderDetails, quantity: Number.parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección de entrega *</Label>
            <Input
              id="address"
              placeholder="Calle, número, piso, depto"
              value={orderDetails.deliveryAddress}
              onChange={(e) => setOrderDetails({ ...orderDetails, deliveryAddress: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono de contacto *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+54 9 11 1234-5678"
              value={orderDetails.contactPhone}
              onChange={(e) => setOrderDetails({ ...orderDetails, contactPhone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instrucciones de entrega (opcional)</Label>
            <Textarea
              id="instructions"
              placeholder="Ej: Tocar timbre 3B, dejar con portero, etc."
              value={orderDetails.deliveryInstructions}
              onChange={(e) => setOrderDetails({ ...orderDetails, deliveryInstructions: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Método de pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={orderDetails.paymentMethod}
            onValueChange={(value) => setOrderDetails({ ...orderDetails, paymentMethod: value })}
          >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="efectivo" id="efectivo" />
                <Label htmlFor="efectivo">Efectivo</Label>
              </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {selectedPharmacy && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  Subtotal ({orderDetails.quantity} unidad{orderDetails.quantity > 1 ? "es" : ""})
                </span>
                <span>${(getPharmacyPrice(selectedPharmacy.id) * orderDetails.quantity).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Envío</span>
                <span>${selectedPharmacy.deliveryFee.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">
                  $
                  {(
                    getPharmacyPrice(selectedPharmacy.id) * orderDetails.quantity +
                    selectedPharmacy.deliveryFee
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button size="lg" className="w-full" onClick={handleSubmitOrder}>
        Confirmar pedido
      </Button>
    </div>
  )
}
