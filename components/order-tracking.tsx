"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Package,
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
  FileText,
  AlertTriangle,
  Truck,
  RefreshCcw,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { OrderStatus, OrderWithItems } from "@/lib/types/orders"

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: LucideIcon; className: string; iconColor: string }> = {
  processing: {
    label: "En proceso",
    icon: Clock,
    className: "bg-blue-100 text-blue-800 border border-blue-200",
    iconColor: "text-blue-600",
  },
  accepted: {
    label: "Aceptado",
    icon: Package,
    className: "bg-purple-100 text-purple-800 border border-purple-200",
    iconColor: "text-purple-600",
  },
  delivering: {
    label: "En camino",
    icon: Truck,
    className: "bg-amber-100 text-amber-800 border border-amber-200",
    iconColor: "text-amber-600",
  },
  delivered: {
    label: "Entregado",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border border-green-200",
    iconColor: "text-green-600",
  },
  cancelled: {
    label: "Cancelado",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-800 border border-red-200",
    iconColor: "text-red-600",
  },
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "-"
  return new Date(value).toLocaleString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const renderStatusBadge = (status: OrderStatus) => {
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon

  return (
    <Badge className={config.className}>
      <StatusIcon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}

const renderStatusIcon = (status: OrderStatus) => {
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon

  return <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
}

export function OrderTracking() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasLoadedUser, setHasLoadedUser] = useState(false)

  useEffect(() => {
    try {
      const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("user") : null
      if (storedUser) {
        setUser(JSON.parse(storedUser) as Record<string, unknown>)
      }
    } catch (error) {
      console.error("Error parsing user from localStorage", error)
    } finally {
      setHasLoadedUser(true)
    }
  }, [])

  const fetchOrders = useCallback(
    async (showGlobalLoading = true) => {
      const identifier = user?.id
      if (typeof identifier !== "string" && typeof identifier !== "number") {
        return
      }

      setFetchError(null)
      if (showGlobalLoading) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const customerId = encodeURIComponent(String(identifier))
        const response = await fetch(`/api/orders?customerId=${customerId}`, { cache: "no-store" })
        const payload = (await response.json().catch(() => null)) as unknown

        if (!response.ok) {
          const message = (payload as { error?: string } | null)?.error ?? "No se pudo obtener los pedidos"
          throw new Error(message)
        }

        if (!Array.isArray(payload)) {
          throw new Error("Formato de respuesta inválido")
        }

        setOrders(payload as OrderWithItems[])
      } catch (error) {
        console.error("Error fetching orders", error)
        setFetchError(error instanceof Error ? error.message : "No se pudieron cargar los pedidos")
      } finally {
        if (showGlobalLoading) {
          setIsLoading(false)
        } else {
          setIsRefreshing(false)
        }
      }
    },
    [user?.id],
  )

  useEffect(() => {
    if (!hasLoadedUser) return

    const identifier = user?.id
    if (typeof identifier !== "string" && typeof identifier !== "number") {
      setIsLoading(false)
      return
    }

    fetchOrders().catch((error) => console.error("Error inicial al cargar pedidos", error))
  }, [fetchOrders, hasLoadedUser, user?.id])

  const handleRefresh = useCallback(async () => {
    await fetchOrders(false)
  }, [fetchOrders])

  const activeOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled")
  const completedOrders = orders.filter((order) => order.status === "delivered" || order.status === "cancelled")

  const renderOrderCard = (order: OrderWithItems) => (
    <Card key={order.id} className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Pedido #{order.orderNumber ?? order.id}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Realizado el {formatDateTime(order.createdAt)} | ${order.total.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {renderStatusIcon(order.status)}
            {renderStatusBadge(order.status)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {order.prescriptionRequired && (
          <Alert className={order.prescriptionStatus === "rejected" ? "border-red-200 bg-red-50" : ""}>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="font-medium">Receta médica</p>
                  {order.prescriptionStatus === "rejected" ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-700">
                        Motivo: {order.prescriptionRejectionReason || "Receta no válida"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Sube una nueva receta válida para que la farmacia pueda continuar.
                      </p>
                    </div>
                  ) : order.prescriptionRejectionReason ? (
                    <p className="text-sm text-muted-foreground">Motivo: {order.prescriptionRejectionReason}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Archivo:</span>
                    {order.prescriptionFileUrl ? (
                      <a
                        href={order.prescriptionFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {order.prescriptionFileName || "Descargar receta"}
                      </a>
                    ) : (
                      <span>{order.prescriptionFileName || "Pendiente de carga"}</span>
                    )}
                  </div>
                </div>
                {order.prescriptionStatus === "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => router.push("/pedidos")}>
                    Cargar nueva receta
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 rounded-lg bg-muted/50 p-4 md:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Dirección de entrega</p>
              <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
              {order.deliveryInstructions && (
                <p className="mt-1 text-xs italic text-muted-foreground">{order.deliveryInstructions}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Método de pago</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {order.paymentMethod ? order.paymentMethod.replace(/-/g, " ") : "No especificado"}
                </p>
              </div>
            </div>
            {order.estimatedDelivery && (
              <p className="text-xs text-muted-foreground">Entrega estimada: {formatDateTime(order.estimatedDelivery)}</p>
            )}
            {order.actualDelivery && (
              <p className="text-xs text-green-600">Entregado: {formatDateTime(order.actualDelivery)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium">{order.pharmacyName}</p>
            <p className="text-sm text-muted-foreground">Farmacia</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Productos</h4>
          {order.items.map((item) => (
            <div
              key={item.id ?? `${item.orderId}-${item.medicationId}`}
              className="flex items-center justify-between rounded border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.medicationName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.brand ? `${item.brand} - ` : ""}Cantidad: {item.quantity}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">${item.finalPrice.toLocaleString()}</p>
                {item.insuranceSavings > 0 && (
                  <p className="text-xs text-green-600">Ahorro: ${item.insuranceSavings.toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>${order.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Envío</span>
            <span>${order.deliveryFee.toLocaleString()}</span>
          </div>
          {order.insuranceDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento obra social</span>
              <span>- ${order.insuranceDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">${order.total.toLocaleString()}</span>
          </div>
          {/* Se removió la visualización de la obra social utilizada */}
        </div>

        <div className="border-t pt-4" />
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center text-muted-foreground">Cargando pedidos...</div>
      </div>
    )
  }

  if (hasLoadedUser && (typeof user?.id !== "string" && typeof user?.id !== "number")) {
    return (
      <Card>
        <CardContent className="space-y-4 py-12 text-center">
          <Package className="mx-auto h-16 w-16 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Inicia sesión para ver tus pedidos</h3>
            <p className="text-sm text-muted-foreground">
              Debes estar autenticado como cliente para acceder al seguimiento de pedidos.
            </p>
          </div>
          <Button onClick={() => router.push("/auth")} className="inline-flex items-center gap-2">
            Ir a iniciar sesión
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {fetchError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="active" className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:min-w-[320px]">
            <TabsTrigger value="active">Pedidos activos ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Historial ({completedOrders.length})</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 self-end md:self-auto"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <TabsContent value="active" className="space-y-4">
          {activeOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No tienes pedidos activos</h3>
                <p className="mb-4 text-muted-foreground">Cuando realices un pedido, lo verás aquí.</p>
                <Button onClick={() => router.push("/medicamentos")}>Ver catálogo</Button>
              </CardContent>
            </Card>
          ) : (
            activeOrders.map(renderOrderCard)
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No tienes pedidos completados</h3>
                <p className="text-muted-foreground">Tu historial aparecerá aquí cuando recibas tus pedidos.</p>
              </CardContent>
            </Card>
          ) : (
            completedOrders.map(renderOrderCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
