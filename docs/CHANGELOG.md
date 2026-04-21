# Changelog

Todas las versiones notables de este proyecto.

Formato: `Major.Minor.Patch`
- **Major**: cambios incompatibles con versiones anteriores
- **Minor**: nuevas features compatibles
- **Patch**: bug fixes

---

## [1.0.0] — 2026-04-21

### Lanzamiento inicial

**Cliente:**
- ✨ Auth por número WhatsApp (sin contraseña)
- ✨ Selector de marca Arepa Lovers / Smash Lovers
- ✨ Menú dinámico con categorías y Realtime
- ✨ Carrito persistente con cantidad editable
- ✨ Checkout en 3 pasos: dirección → pago → confirmar
- ✨ Pago con tarjeta (MIO) y transferencia bancaria
- ✨ Upload de comprobante (JPEG/PNG, max 2MB)
- ✨ Validación geográfica GPS
- ✨ 2x1 bienvenida (primera compra)
- ✨ Loyalty Cash (RD$10 = 1 punto, acumulado automático)
- ✨ Código referido personal (RD$100 crédito al referidor)
- ✨ Códigos influencer (15% OFF primera compra)
- ✨ Rastreo de pedido en tiempo real
- ✨ Reseñas (30 min post-entrega)
- ✨ Perfil con historial de loyalty y pedidos
- ✨ Notificaciones WhatsApp (4 mensajes automáticos)

**Admin:**
- ✨ Dashboard con stats del día en tiempo real
- ✨ Pedidos activos con alertas sonoras
- ✨ Aceptar / cancelar / marcar listo / pedir repartidor
- ✨ Aprobación de comprobantes de transferencia
- ✨ Impresión de comanda PDF 80mm (EPSON TM-T20II)
- ✨ Historial de pedidos con filtros
- ✨ Gestión de menú: productos, categorías, reordenar
- ✨ Colores de marca dinámicos (presets temáticos)
- ✨ Configuración bancaria en tiempo real
- ✨ Horarios de apertura y días hábiles
- ✨ Mensajes WhatsApp editables con variables
- ✨ Configuración de alertas sonoras
- ✨ Zonas de entrega por coordenadas GPS
- ✨ Códigos influencer con liquidación
- ✨ Recordatorios de pagos fijos
- ✨ Gestión de facturas pendientes
- ✨ Admins secundarios (permisos limitados)

**Infraestructura:**
- ✨ Next.js 14 App Router + TypeScript strict
- ✨ Supabase (PostgreSQL + Realtime + Storage + Edge Functions)
- ✨ Vercel (staging + producción)
- ✨ GitHub Actions CI/CD (tests + deploy automático staging, manual prod)
- ✨ PWA (installable en móvil)
- ✨ Tests unitarios (Jest) + E2E (Playwright)

---

## Template para próximas versiones

## [1.1.0] — FECHA

### Features
- ✨ Nuevo: descripción

### Fixes
- 🐛 Fix: descripción

### Breaking Changes
- ⚠️ Descripción
