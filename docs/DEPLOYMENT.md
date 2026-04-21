# Deployment Guide

## Ambientes

| Ambiente | URL | Branch | Deploy |
|----------|-----|--------|--------|
| Local | `localhost:3000` | cualquiera | `npm run dev` |
| Staging | `staging-arepa-smash-lovers.vercel.app` | `staging` | Automático |
| Producción | `arepa-smash-lovers.com` | `main` | Manual (workflow_dispatch) |

---

## 1. Setup inicial (solo primera vez)

### Supabase — crear 2 proyectos

1. Ve a [supabase.com](https://supabase.com) → New project
2. Crea proyecto **arepa-smash-staging** (región: US East)
3. Crea proyecto **arepa-smash-prod** (misma región)
4. En cada proyecto, ejecuta las migraciones:
   ```
   supabase db push --project-ref <PROJECT_REF>
   ```
5. Habilita Realtime para las tablas: `orders`, `brand_colors`, `app_settings`
6. Crea bucket de Storage: `comprobantes` (público), `product-photos` (público)
7. Despliega las Edge Functions:
   ```bash
   supabase functions deploy loyalty-points --project-ref <PROJECT_REF>
   supabase functions deploy welcome-offer-generator --project-ref <PROJECT_REF>
   ```

### Vercel — crear 2 proyectos

1. Ve a [vercel.com](https://vercel.com) → Add New Project
2. Importa el repo `Lovers-lab/arepa-smash-lovers`
3. Proyecto 1: `arepa-smash-staging`
   - Branch: `staging`
   - Framework: Next.js
4. Proyecto 2: `arepa-smash-prod`
   - Branch: `main`
   - Framework: Next.js

### Variables de entorno en Vercel

Para **staging** (`arepa-smash-staging`):
```
NEXT_PUBLIC_SUPABASE_URL=https://staging-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<staging_service_role_key>
NEXT_PUBLIC_APP_URL=https://staging-arepa-smash-lovers.vercel.app
KDS_WEBHOOK_SECRET=staging-secret-xyz
TWILIO_ACCOUNT_SID=<twilio_sid>
TWILIO_AUTH_TOKEN=<twilio_token>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
MIO_API_URL=https://sandbox.mio.com.do/v1
MIO_API_KEY=<mio_sandbox_key>
MIO_API_SECRET=<mio_sandbox_secret>
```

Para **producción** (`arepa-smash-prod`):
```
NEXT_PUBLIC_SUPABASE_URL=https://prod-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<prod_service_role_key>
NEXT_PUBLIC_APP_URL=https://arepa-smash-lovers.com
KDS_WEBHOOK_SECRET=<prod_secret_muy_seguro>
TWILIO_ACCOUNT_SID=<twilio_sid>
TWILIO_AUTH_TOKEN=<twilio_token>
TWILIO_WHATSAPP_NUMBER=whatsapp:+1XXXXXXXXXX
MIO_API_URL=https://api.mio.com.do/v1
MIO_API_KEY=<mio_prod_key>
MIO_API_SECRET=<mio_prod_secret>
```

### GitHub Secrets (para CI/CD)

Ve a repo → Settings → Secrets and variables → Actions:

```
VERCEL_TOKEN=<tu_vercel_token>
VERCEL_ORG_ID=<tu_org_id>
VERCEL_STAGING_PROJECT_ID=<staging_project_id>
VERCEL_PROD_PROJECT_ID=<prod_project_id>
STAGING_SUPABASE_URL=<staging_url>
STAGING_SUPABASE_ANON_KEY=<staging_anon>
STAGING_SERVICE_ROLE_KEY=<staging_service_role>
STAGING_APP_URL=https://staging-arepa-smash-lovers.vercel.app
PROD_SUPABASE_URL=<prod_url>
PROD_SUPABASE_ANON_KEY=<prod_anon>
SLACK_WEBHOOK_URL=<slack_webhook>
```

---

## 2. Flujo de deploy normal

```
feature/xxx → develop → staging → main (prod)
```

### Deploy a staging
```bash
git checkout staging
git merge develop
git push origin staging
# GitHub Actions despliega automáticamente
```

### Deploy a producción (manual)
1. GitHub → Actions → "Deploy — Production"
2. Click "Run workflow"
3. Escribe `DEPLOY` en el campo de confirmación
4. Click "Run workflow"

---

## 3. Primer admin

Después de crear el proyecto Supabase en producción:

```sql
-- 1. Crear usuario en Supabase Auth (Dashboard → Auth → Users → Add user)
-- Email: tu-email@dominio.com
-- Password: contraseña_segura

-- 2. Obtener el UUID del usuario creado y ejecutar:
INSERT INTO admin_users (id, nombre, rol, activo)
VALUES ('uuid-del-usuario', 'Juan Nachón', 'PRINCIPAL', true);
```

---

## 4. Dominio custom en Vercel

1. Vercel → arepa-smash-prod → Settings → Domains
2. Agrega `arepa-smash-lovers.com`
3. En tu DNS provider, apunta:
   - `A` record → `76.76.21.21`
   - `CNAME` www → `cname.vercel-dns.com`
4. SSL se configura automáticamente

---

## 5. Supabase Webhooks (para Edge Functions)

En Supabase Dashboard → Database → Webhooks → Create new:

**Webhook 1: Loyalty on delivery**
- Name: `loyalty-on-delivery`
- Table: `orders`
- Events: `UPDATE`
- URL: `https://<project-ref>.supabase.co/functions/v1/loyalty-points`
- HTTP Headers: `Authorization: Bearer <service_role_key>`

**Webhook 2: Welcome offer**
- Name: `welcome-offer-on-register`
- Table: `users`
- Events: `INSERT`
- URL: `https://<project-ref>.supabase.co/functions/v1/welcome-offer-generator`

---

## 6. Hotfix en producción

```bash
# Crear rama desde main
git checkout main
git checkout -b hotfix/descripcion-del-bug

# Fix, commit, push
git add .
git commit -m "hotfix: descripcion del fix"
git push origin hotfix/descripcion-del-bug

# PR → main (requiere 2 approvals, luego deploy manual)
# Después del merge a main, también mergear a develop:
git checkout develop
git merge main
git push origin develop
```

---

## 7. Rollback

Si algo sale mal en producción:

```bash
# En Vercel: Deployments → selecciona el deploy anterior → ... → Promote to Production
# O via CLI:
vercel rollback
```

Para DB: Supabase hace backups automáticos cada 24h. Contacta soporte si necesitas restore.
