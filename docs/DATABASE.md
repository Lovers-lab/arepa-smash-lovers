# Database Schema

Stack: Supabase (PostgreSQL 15) + Row Level Security + Realtime + Storage

---

## Tablas principales

### `users` — Clientes
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | auto |
| whatsapp | VARCHAR UNIQUE | 10 dígitos sin formato |
| nombre | VARCHAR | requerido |
| email | VARCHAR | opcional |
| direccion | TEXT | última dirección usada |
| latitude/longitude | DECIMAL | coordenadas GPS |
| dentro_zona | BOOLEAN | resultado de validación GPS |
| fecha_registro | TIMESTAMPTZ | auto |
| cliente_vip | BOOLEAN | auto: true si gastó ≥ RD$10,000 |
| total_gastado | DECIMAL | acumulado lifetime |
| total_compras | INTEGER | acumulado lifetime |
| referido_por | UUID FK users | si fue referido |
| activo | BOOLEAN | soft delete |

### `categories` — Categorías del menú
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | auto |
| nombre | VARCHAR | ej: "AREPAS ESPECIALES" |
| descripcion | TEXT | opcional |
| marca | VARCHAR | 'AREPA' o 'SMASH' |
| orden | INTEGER | posición en el menú |
| activo | BOOLEAN | visible para cliente si true |

### `products` — Productos
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | auto |
| nombre | VARCHAR | requerido |
| descripcion | TEXT | opcional |
| precio | DECIMAL | en RD$ |
| marca | VARCHAR | 'AREPA' o 'SMASH' |
| category_id | UUID FK | requerido |
| activo | BOOLEAN | visible si true |
| foto_url | TEXT | URL Cloudinary/Supabase Storage |
| orden_en_categoria | INTEGER | posición dentro de la categoría |

### `orders` — Órdenes
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | auto |
| numero_pedido | INTEGER UNIQUE | secuencial, desde 501 |
| user_id | UUID FK | requerido |
| estado | VARCHAR | ver estados abajo |
| marca | VARCHAR | 'AREPA' o 'SMASH' |
| metodo_pago | VARCHAR | 'TARJETA' o 'TRANSFERENCIA' |
| monto_original | DECIMAL | sin descuentos |
| descuento | DECIMAL | 2x1 + loyalty aplicados |
| monto_final | DECIMAL | post-descuentos |
| costo_envio | DECIMAL | 0 o 50 |
| total_pagado | DECIMAL | monto_final + envío |
| comprobante_url | TEXT | foto transferencia |
| notas_cliente | TEXT | dirección + instrucciones |
| notas_admin | TEXT | log de acciones admin |
| fecha_orden | TIMESTAMPTZ | auto |
| hora_pago_confirmado | TIMESTAMPTZ | cuando acepta admin |
| hora_listo | TIMESTAMPTZ | cuando marca listo |
| hora_entregado | TIMESTAMPTZ | cuando entrega |
| tiempo_cocina | INTEGER | minutos en cocina |
| tiempo_entrega | INTEGER | minutos en delivery |

**Estados de orden:**
```
PENDIENTE → PAGADO → EN_COCINA → LISTO → ENVIO_SOLICITADO → EN_CAMINO → ENTREGADO
                                                                        ↘ CANCELADO
```

### `order_items` — Ítems por orden
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | auto |
| order_id | UUID FK | cascade delete |
| product_id | UUID FK | referencia al producto |
| cantidad | INTEGER | ≥ 1 |
| precio_unitario | DECIMAL | precio al momento de la compra |
| subtotal | DECIMAL | cantidad × precio |
| notas | TEXT | instrucciones del ítem |

### `loyalty_balances` — Saldo Loyalty Cash
| Columna | Tipo | Notas |
|---------|------|-------|
| user_id | UUID PK FK | uno por usuario |
| saldo | DECIMAL | disponible actualmente |
| total_ganado | DECIMAL | lifetime ganado |
| total_gastado | DECIMAL | lifetime gastado |

### `loyalty_transactions` — Historial de movimientos
| Columna | Tipo | Notas |
|---------|------|-------|
| tipo | VARCHAR | 'GANADO', 'GASTADO', 'EXPIRADO' |
| puntos | DECIMAL | cantidad del movimiento |
| saldo_resultante | DECIMAL | saldo después del movimiento |

### `welcome_offers` — 2x1 bienvenida
| Columna | Tipo | Notas |
|---------|------|-------|
| user_id | UUID UNIQUE FK | un 2x1 por usuario |
| codigo | VARCHAR UNIQUE | auto-generado |
| usado | BOOLEAN | se marca true al usar |
| fecha_expiracion | TIMESTAMPTZ | +30 días desde registro |

### `brand_colors` — Colores dinámicos
| Columna | Tipo | Notas |
|---------|------|-------|
| marca | VARCHAR UNIQUE | 'AREPA' o 'SMASH' |
| color_primario | VARCHAR | hex color |
| color_secundario | VARCHAR | hex color |
| color_texto | VARCHAR | hex color |
| color_fondo | VARCHAR | hex color |
| color_botones | VARCHAR | hex color |
| color_links | VARCHAR | hex color |
| color_bordes | VARCHAR | hex color |
| tema_activo | VARCHAR | DEFAULT/NAVIDAD/etc |
| historial | JSONB | array de versiones previas |

### `app_settings` — Configuración por marca
| Columna | Tipo | Notas |
|---------|------|-------|
| marca | VARCHAR UNIQUE | 'AREPA' o 'SMASH' |
| banco_* | VARCHAR | datos bancarios |
| metodo_tarjeta_activo | BOOLEAN | toggle MIO |
| metodo_transferencia_activo | BOOLEAN | toggle transferencia |
| horario_apertura/cierre | TIME | HH:MM |
| dias_abierto | TEXT[] | ['lun','mar',...] |
| envio_gratis_umbral | DECIMAL | default 1000 |
| envio_costo | DECIMAL | default 50 |
| msg_* | TEXT | templates WhatsApp con {{variables}} |
| sonido_* | mixed | config alertas admin |

### `influencer_codes` — Códigos influencer
| Columna | Tipo | Notas |
|---------|------|-------|
| codigo | VARCHAR UNIQUE | ej: 'CARLOSCHEF' |
| porcentaje_comision | INTEGER | ej: 12 |
| saldo_acumulado | DECIMAL | comisión pendiente de pago |
| tipo_pago | VARCHAR | 'TRANSFER' o 'CREDITO_COMIDA' |

### `delivery_zones` — Zonas de entrega
| Columna | Tipo | Notas |
|---------|------|-------|
| nombre | VARCHAR | ej: 'Santo Domingo Este' |
| coordenadas | JSONB | {minLat, maxLat, minLng, maxLng} |
| activo | BOOLEAN | si false, no se usa |

---

## Triggers automáticos

| Trigger | Cuando | Qué hace |
|---------|--------|----------|
| `trg_welcome_offer_on_register` | INSERT en users | Crea oferta 2x1 automáticamente |
| `trg_loyalty_on_delivery` | UPDATE orders → ENTREGADO | Acumula puntos Loyalty Cash |
| `trg_order_delivered` | UPDATE orders → ENTREGADO | Calcula tiempos, acumula comisión influencer |

---

## Row Level Security

- `products`, `categories`, `brand_colors`, `app_settings`: lectura pública
- `orders`, `users`: escritura con service role key (APIs del servidor)
- Admin actions: via service role key en API routes (nunca desde el cliente)

---

## Supabase Realtime

Tablas con Realtime habilitado:
- `orders` — admin dashboard actualización instantánea
- `brand_colors` — cambios de tema en vivo para clientes
- `app_settings` — datos bancarios actualizados sin recargar

---

## Storage Buckets

| Bucket | Acceso | Uso |
|--------|--------|-----|
| `comprobantes` | Privado | Fotos de transferencias. Auto-delete 90 días |
| `product-photos` | Público | Fotos de productos del menú |
