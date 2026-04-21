# Setup Local

Guía para correr el proyecto en tu máquina.

## Prerequisitos

- Node.js 20+ (`node --version`)
- npm 10+
- Git
- Cuenta en Supabase (gratis)

> **macOS 12 o anterior**: Node 20 no es compatible. Usa [nvm](https://github.com/nvm-sh/nvm) para instalar Node 18 LTS.
> ```bash
> curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
> nvm install 18
> nvm use 18
> ```

---

## Paso 1 — Clonar el repo

```bash
git clone https://github.com/Lovers-lab/arepa-smash-lovers.git
cd arepa-smash-lovers
```

## Paso 2 — Instalar dependencias

```bash
npm install
```

## Paso 3 — Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con los valores de tu proyecto Supabase (staging):

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Paso 4 — Ejecutar migraciones en Supabase

Opción A — Desde el Dashboard:
1. Ve a tu proyecto Supabase → SQL Editor
2. Copia y ejecuta `supabase/migrations/20240421_init.sql`
3. Luego ejecuta `supabase/migrations/20240422_helpers.sql`

Opción B — Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase db push
```

## Paso 5 — Crear primer admin en Supabase

1. Ve a Supabase Dashboard → Authentication → Users → Add user
2. Email: tu-email@gmail.com, Password: tu contraseña
3. Copia el UUID del usuario creado
4. Ve a SQL Editor y ejecuta:
```sql
INSERT INTO admin_users (id, nombre, rol, activo)
VALUES ('PEGA-EL-UUID-AQUI', 'Tu Nombre', 'PRINCIPAL', true);
```

## Paso 6 — Correr el servidor

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## URLs útiles

| Ruta | Descripción |
|------|-------------|
| `/` | Selector de marca (cliente) |
| `/auth/login` | Login cliente (WhatsApp) |
| `/menu` | Menú (requiere login) |
| `/admin/dashboard` | Panel admin |
| `/auth/login/admin` | Login admin |

---

## Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run lint         # Verificar código
npm run lint:fix     # Corregir automáticamente
npm run type-check   # TypeScript strict
npm run test         # Unit tests
npm run test:coverage # Con cobertura
npm run format       # Prettier
```

---

## Troubleshooting

**Error: `NEXT_PUBLIC_SUPABASE_URL is not set`**
→ Verifica que `.env.local` existe y tiene los valores correctos.

**Error: `relation "users" does not exist`**
→ Las migraciones SQL no se ejecutaron. Repite el Paso 4.

**La app no carga (pantalla en blanco)**
→ Abre DevTools → Console, busca el error. Usualmente es una variable de entorno faltante.

**Admin login falla con credenciales correctas**
→ Verifica que el usuario existe en la tabla `admin_users` con `activo = true`.

**Imágenes de productos no cargan**
→ Configura las variables `CLOUDINARY_*` o usa URLs de Supabase Storage.
