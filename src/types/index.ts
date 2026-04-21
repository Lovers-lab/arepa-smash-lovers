// ============================================================
// AREPA SMASH LOVERS - Core Types
// ============================================================

export type Marca = 'AREPA' | 'SMASH'

export type OrderStatus =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'EN_COCINA'
  | 'LISTO'
  | 'ENVIO_SOLICITADO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'CANCELADO'

export type MetodoPago = 'TARJETA' | 'TRANSFERENCIA'

export type AdminRole = 'PRINCIPAL' | 'SECUNDARIO'

// ---- USERS ----

export interface User {
  id: string
  whatsapp: string
  nombre: string
  email?: string
  direccion?: string
  latitude?: number
  longitude?: number
  dentro_zona: boolean
  fecha_registro: string
  cliente_vip: boolean
  total_gastado: number
  total_compras: number
  referido_por?: string
  activo: boolean
}

// ---- PRODUCTS & CATEGORIES ----

export interface Category {
  id: string
  nombre: string
  descripcion?: string
  marca: Marca
  orden: number
  activo: boolean
  product_count?: number
  created_at: string
}

export interface Product {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  marca: Marca
  category_id: string
  category?: Category
  activo: boolean
  foto_url?: string
  orden_en_categoria: number
  created_at: string
}

// ---- ORDERS ----

export interface Order {
  id: string
  numero_pedido: number
  user_id: string
  user?: User
  estado: OrderStatus
  marca: Marca
  metodo_pago: MetodoPago
  monto_original: number
  descuento: number
  monto_final: number
  costo_envio: number
  total_pagado: number
  cupones_usados?: string[]
  codigo_referido?: string
  codigo_influencer?: string
  pedidosya_id?: string
  fecha_orden: string
  hora_pago_confirmado?: string
  hora_listo?: string
  hora_entregado?: string
  tiempo_cocina?: number
  tiempo_entrega?: number
  notas_admin?: string
  notas_cliente?: string
  comprobante_url?: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product?: Product
  cantidad: number
  precio_unitario: number
  subtotal: number
  notas?: string
}

// ---- CART ----

export interface CartItem {
  product: Product
  cantidad: number
  notas?: string
}

export interface Cart {
  marca: Marca
  items: CartItem[]
  subtotal: number
  descuento: number
  costo_envio: number
  total: number
}

// ---- LOYALTY ----

export interface LoyaltyTransaction {
  id: string
  user_id: string
  order_id?: string
  tipo: 'GANADO' | 'GASTADO' | 'EXPIRADO'
  puntos: number
  saldo_resultante: number
  descripcion: string
  created_at: string
}

export interface LoyaltyBalance {
  user_id: string
  saldo: number
  total_ganado: number
  total_gastado: number
}

// ---- PROMO CODES ----

export interface WelcomeOffer {
  id: string
  user_id: string
  codigo: string
  usado: boolean
  fecha_generacion: string
  fecha_expiracion: string
  fecha_uso?: string
  order_id?: string
}

export interface InfluencerCode {
  id: string
  codigo: string
  nombre_influencer: string
  whatsapp_influencer: string
  porcentaje_comision: number
  descripcion?: string
  activo: boolean
  saldo_acumulado: number
  tipo_pago: 'TRANSFER' | 'CREDITO_COMIDA'
  created_at: string
  created_by: string
  actualizado_por?: string
}

export interface ReferralCode {
  id: string
  user_id: string
  codigo: string
  usos: number
  credito_acumulado: number
  created_at: string
}

// ---- BRAND COLORS ----

export interface BrandColors {
  id: string
  marca: Marca
  color_primario: string
  color_secundario: string
  color_texto: string
  color_fondo: string
  color_botones: string
  color_links: string
  color_bordes: string
  tema_activo: 'DEFAULT' | 'NAVIDAD' | 'ANO_NUEVO' | 'SAN_VALENTIN' | 'HALLOWEEN' | 'INDEPENDENCIA_RD' | 'CUSTOM'
  fecha_cambio: string
  modificado_por: string
  historial?: BrandColorsSnapshot[]
  activo: boolean
}

export interface BrandColorsSnapshot {
  fecha: string
  admin: string
  colores: Omit<BrandColors, 'id' | 'marca' | 'historial'>
}

// ---- SETTINGS ----

export interface AppSettings {
  id: string
  marca: Marca
  banco_nombre?: string
  banco_cuenta?: string
  banco_titular?: string
  banco_ruc?: string
  banco_instrucciones?: string
  metodo_tarjeta_activo: boolean
  metodo_transferencia_activo: boolean
  horario_apertura: string
  horario_cierre: string
  dias_abierto: string[]
  envio_gratis_umbral: number
  envio_costo: number
  msg_cocina: string
  msg_repartidor_camino: string
  msg_en_ruta: string
  msg_entregado: string
  sonido_activo: boolean
  sonido_volumen: number
  sonido_tipo: string
  updated_at: string
}

// ---- DELIVERY ZONES ----

export interface DeliveryZone {
  id: string
  nombre: string
  coordenadas: GeoJSON.Polygon
  activo: boolean
  created_at: string
}

// ---- REVIEWS ----

export interface Review {
  id: string
  order_id: string
  user_id: string
  user?: User
  estrellas: number
  comentario?: string
  created_at: string
}

// ---- ADMIN ----

export interface AdminUser {
  id: string
  email: string
  nombre: string
  rol: AdminRole
  activo: boolean
  created_at: string
}

// ---- REMINDERS & INVOICES ----

export interface Reminder {
  id: string
  nombre: string
  monto: number
  frecuencia: 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'ANUAL' | 'CUSTOM'
  dia_del_mes: number
  marca: Marca | 'AMBAS'
  activo: boolean
  dias_anticipacion: number
  created_at: string
}

export interface PendingInvoice {
  id: string
  nombre: string
  monto: number
  proveedor?: string
  marca: Marca | 'AMBAS'
  fecha_vencimiento: string
  prioridad: 'NORMAL' | 'URGENTE'
  descripcion?: string
  archivo_url?: string
  pagada: boolean
  fecha_pago?: string
  created_at: string
}

// ---- API RESPONSES ----

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
