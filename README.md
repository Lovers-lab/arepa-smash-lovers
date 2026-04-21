# 🫓🍔 Arepa & Smash Lovers — Sistema de Delivery

Sistema de pedidos online para dos ghost kitchens en Santo Domingo, RD.

**Arepa Lovers** · comida venezolana · `#C41E3A`  
**Smash Lovers** · smash burgers · `#0052CC`

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, CSS Variables (brand theming dinámico) |
| Backend | Next.js API Routes + Supabase Edge Functions |
| Database | Supabase (PostgreSQL + Realtime + Storage + Auth) |
| Auth admin | Supabase Auth (email + password) |
| Auth cliente | WhatsApp phone number (localStorage session) |
| PDF comandas | jsPDF (80mm thermal) |
| Notificaciones | Howler.js (sound), Browser Notifications, WhatsApp API |
| Pagos tarjeta | MIO Payment Gateway (DR) |
| Mapas | Leaflet + React Leaflet |
| Deploy | Vercel (staging + production) |
| CI/CD | GitHub Actions |

---

## Setup local

```bash
# 1. Clonar repo
git clone https://github.com/Lovers-lab/arepa-smash-lovers.git
cd arepa-smash-lovers

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores de Supabase

# 4. Correr migraciones
npx supabase db push

# 5. Iniciar en modo desarrollo
npm run dev
```

La app estará en `http://localhost:3000`.

---

## Estructura del proyecto

```
src/
├── app/              # Next.js App Router
│   ├── auth/         # Login cliente (WhatsApp)
│   ├── (client)/     # Menú, carrito, checkout, perfil
│   ├── admin/        # Panel administración
│   └── api/          # API routes
├── components/       # Componentes reutilizables
├── lib/
│   ├── supabase/     # Clientes Supabase
│   ├── api/          # Integraciones externas (MIO, WhatsApp, PedidosYa)
│   └── utils/        # Helpers (comanda PDF, formatters, validators)
├── styles/           # CSS global + design tokens
└── types/            # TypeScript types
supabase/
├── migrations/       # SQL migrations (numbered)
└── functions/        # Edge Functions
```

---

## Ambientes

| Ambiente | URL | Branch | Supabase |
|----------|-----|--------|---------|
| Local | `localhost:3000` | any | local instance |
| Staging | `staging-arepa-smash.vercel.app` | `staging` | staging project |
| Producción | `arepa-smash-lovers.com` | `main` | prod project |

---

## Comandos útiles

```bash
npm run dev              # Desarrollo local
npm run build            # Build para producción
npm run lint             # Verificar código
npm run lint:fix         # Corregir automáticamente
npm run type-check       # TypeScript strict check
npm run test             # Unit tests
npm run test:coverage    # Con reporte de cobertura
npm run format           # Prettier
```

---

## Documentación

- [Setup local](docs/SETUP.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [API endpoints](docs/API.md)
- [Base de datos](docs/DATABASE.md)
- [Deploy](docs/DEPLOYMENT.md)
- [Seguridad](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Contributing](CONTRIBUTING.md)

---

## Features principales

### 👥 Cliente
- Auth por número WhatsApp (sin contraseña)
- Selector de marca (Arepa / Smash)
- Menú dinámico con categorías (Supabase Realtime)
- Carrito persistente (localStorage)
- Checkout en 3 pasos (dirección → pago → confirmar)
- Pago con tarjeta (MIO) o transferencia bancaria (foto comprobante)
- Validación geográfica por GPS
- 2x1 de bienvenida (1ª compra)
- Loyalty Cash (RD$10 = 1 punto)
- Código referido + influencer
- Rastreo de pedido en tiempo real
- Reseñas (30min post-entrega)
- Notificaciones WhatsApp automáticas

### 🔧 Admin
- Dashboard con stats en vivo
- Pedidos activos con alertas sonoras
- Aceptar / cancelar / marcar listo / pedir repartidor
- Impresión de comanda (PDF 80mm)
- Aprobación de comprobantes de transferencia
- Gestión de menú y categorías
- Colores de marca dinámicos (sin redeploy)
- Configuración bancaria en vivo
- Horarios y zonas de entrega
- Administradores secundarios (permisos limitados)
- Recordatorios y facturas pendientes
- Códigos influencer con liquidación
