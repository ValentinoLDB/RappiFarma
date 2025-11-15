"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { MapPin, CreditCard, Truck, Clock, Shield, CheckCircle } from "lucide-react"

export function CheckoutForm() {
  const [deliveryInfo, setDeliveryInfo] = useState({
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    instructions: "",
  })

  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [cardInfo, setCardInfo] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  })

  const [deliveryTime, setDeliveryTime] = useState("standard")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false)
      // Redirect to success page
    }, 3000)
  }

  const orderTotal = 69.48 // This would come from cart context

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
      {/* Checkout Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Delivery Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Dirección de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Dirección completa *</Label>
                <Input
                  id="address"
                  value={deliveryInfo.address}
                  onChange={(e) => setDeliveryInfo((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Calle, número, apartamento"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ciudad *</Label>
                <Input
                  id="city"
                  value={deliveryInfo.city}
                  onChange={(e) => setDeliveryInfo((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Ciudad"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Código Postal *</Label>
                <Input
                  id="postalCode"
                  value={deliveryInfo.postalCode}
                  onChange={(e) => setDeliveryInfo((prev) => ({ ...prev, postalCode: e.target.value }))}
                  placeholder="12345"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono de contacto *</Label>
                <Input
                  id="phone"
                  value={deliveryInfo.phone}
                  onChange={(e) => setDeliveryInfo((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instrucciones de entrega</Label>
              <Textarea
                id="instructions"
                value={deliveryInfo.instructions}
                onChange={(e) => setDeliveryInfo((prev) => ({ ...prev, instructions: e.target.value }))}
                placeholder="Ej: Tocar el timbre, dejar en portería, etc."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Delivery Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tiempo de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={deliveryTime} onValueChange={setDeliveryTime}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="standard" id="standard" />
                <div className="flex-1">
                  <Label htmlFor="standard" className="font-medium">
                    Entrega estándar (2-4 horas)
                  </Label>
                  <p className="text-sm text-muted-foreground">Gratis en pedidos mayores a $50</p>
                </div>
                <span className="font-medium">Gratis</span>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="express" id="express" />
                <div className="flex-1">
                  <Label htmlFor="express" className="font-medium">
                    Entrega express (1-2 horas)
                  </Label>
                  <p className="text-sm text-muted-foreground">Entrega prioritaria</p>
                </div>
                <span className="font-medium">$9.99</span>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Método de Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash">Efectivo contra entrega</Label>
              </div>
            </RadioGroup>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Pagarás en efectivo al momento de la entrega. Asegúrate de tener el monto exacto.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Order Summary */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumen Final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>$59.49</span>
              </div>

              <div className="flex justify-between">
                <span>Envío</span>
                <span>{deliveryTime === "express" ? "$9.99" : "Gratis"}</span>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${deliveryTime === "express" ? "69.48" : "59.49"}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm">
                  Acepto los términos y condiciones y la política de privacidad
                </Label>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={!acceptTerms || isProcessing}>
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  `Confirmar Pedido - $${deliveryTime === "express" ? "69.48" : "59.49"}`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Pago 100% seguro y encriptado</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Truck className="h-4 w-4" />
              <span>Entrega con seguimiento en tiempo real</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
