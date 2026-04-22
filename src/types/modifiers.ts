// Modifier types — add to src/types/index.ts

export interface ModifierGroup {
  id: string
  product_id: string
  nombre: string           // "Elige tu arepa"
  requerido: boolean
  min_opciones: number
  max_opciones: number
  orden: number
  activo: boolean
  options?: ModifierOption[]
}

export interface ModifierOption {
  id: string
  group_id: string
  nombre: string           // "Pollo y Queso Gouda"
  precio_extra: number     // 0 = incluido en el combo
  activo: boolean
  orden: number
}

export interface SelectedModifier {
  groupId: string
  groupNombre: string
  optionId: string
  optionNombre: string
  precioExtra: number
}

// Extended CartItem with modifiers
export interface CartItemWithModifiers {
  product: {
    id: string
    nombre: string
    precio: number
    foto_url?: string
    category_id: string
  }
  cantidad: number
  notas?: string
  modifiers?: SelectedModifier[]  // opciones elegidas
  totalExtras?: number            // suma de precio_extra
}
