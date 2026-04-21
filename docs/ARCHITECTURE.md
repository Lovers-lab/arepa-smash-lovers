# Architecture

## Visión general

```
CLIENTE (mobile/web)
    │
    ├─ Next.js 14 App Router (SSR + Client Components)
    │      ├─ /auth/login          → WhatsApp auth
    │      ├─ /                    → Brand selector
    │      ├─ /menu                → Menú dinámico
    │      ├─ /cart                → Carrito
    │      ├─ /checkout            → Pago
    │      ├─ /orders/[id]         → Rastreo en tiempo real
    │      └─ /profile             → Loyalty + pedidos
    │
    ├─ Next.js API Routes (/app/api/)
    │      ├─ orders/create        → Crear orden + MIO + upload comprobante
    │      ├─ orders/[id]          → Actualizar estado + WhatsApp
    │      ├─ loyalty/balance      → Saldo Loyalty Cash
    │      ├─ welcome-offers/check → Verificar 2x1
    │      ├─ delivery-zones/check → GPS validation
    │      ├─ settings/bank        → Datos bancarios + horarios
    │      └─ admin/users/create   → Crear admin secundario
    │
    └─ Supabase
           ├─ PostgreSQL           → Datos principales
           ├─ Auth                 → Admin users (email+pass)
           ├─ Realtime             → orders, brand_colors, app_settings
           ├─ Storage              → comprobantes, product-photos
           └─ Edge Functions
                  ├─ loyalty-points        → Puntos post-entrega + WhatsApp
                  └─ welcome-offer-generator → 2x1 post-registro + WhatsApp

ADMIN (web)
    └─ /admin/dashboard    → Pedidos activos, stats, alertas sonoras
    └─ /admin/products     → CRUD menú + categorías
    └─ /admin/orders       → Historial filtrable
    └─ /admin/marketing    → Colores dinámicos, influencers
    └─ /admin/settings     → Banco, horarios, WhatsApp msgs
    └─ /admin/reminders    → Facturas y recordatorios
    └─ /admin/delivery-zones → Zonas GPS

INTEGRACIONES EXTERNAS
    ├─ MIO (pagos tarjeta RD)
    ├─ Twilio WhatsApp API (notificaciones)
    └─ PedidosYa API (repartidores) — pendiente
```

## Decisiones de arquitectura

### Auth cliente: localStorage (no sessions)
El cliente se autentica con su número de WhatsApp. No usamos Supabase Auth para clientes porque:
- Login sin contraseña (solo teléfono)
- Sesión permanente deseada
- Supabase Auth es para los admins (email+password)

La sesión del cliente vive en `localStorage` como `lovers_user: {id, nombre, whatsapp}`. Las API routes del servidor usan el service role key para validar/crear datos.

### Single-file HTML → Next.js migration
El sistema anterior (sistema-cocina.html) era un archivo HTML standalone. Esta arquitectura Next.js separa correctamente cliente/servidor y escala para múltiples usuarios simultáneos.

### Firebase → Supabase
Migramos de Firebase Realtime DB a Supabase porque:
- SQL es más robusto para el schema de órdenes
- Row Level Security nativo
- Edge Functions en Deno (más potentes que Cloud Functions)
- Auth integrado para admins
- Storage integrado para comprobantes

### Brand colors via CSS Variables + Realtime
Los colores de marca se almacenan en Supabase. Un Realtime listener actualiza las CSS variables del DOM sin recargar la página. Esto permite cambiar el tema de "Navidad" en tiempo real para todos los clientes conectados.

### PDF de comanda: client-side jsPDF
La comanda se genera en el browser del admin con jsPDF, en formato 80mm (compatible con EPSON TM-T20II). No requiere backend ni conexión a la impresora — el admin imprime con Ctrl+P desde el browser.
