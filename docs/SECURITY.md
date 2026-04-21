# Security

## Principios

- **Mínimo privilegio**: El cliente nunca tiene acceso al service role key
- **Server-side validation**: Todo dato del cliente se valida en el servidor
- **RLS**: Row Level Security activo en todas las tablas sensibles
- **Secrets**: Nunca en el repositorio, siempre en variables de entorno

---

## Autenticación

### Clientes (WhatsApp)
- Número de teléfono = identidad única (UNIQUE en DB)
- Sin contraseña — login instantáneo
- Sesión en `localStorage` (no cookies, no JWT propio)
- Las API routes validan datos vía service role key del servidor
- **Riesgo conocido**: si alguien accede al dispositivo físico, puede suplantar al cliente → aceptable para ghost kitchen

### Admins (email + password)
- Supabase Auth (bcrypt internamente)
- JWT gestionado por Supabase SSR
- Middleware Next.js verifica sesión en cada request admin
- Admin PRINCIPAL vs SECUNDARIO: verificado en cada API route
- **2FA**: recomendado para PRINCIPAL (configurar en Supabase Dashboard)

---

## API Security

### Service Role Key
- Usada **solo en el servidor** (API routes, Edge Functions)
- Nunca expuesta al cliente
- Rotación recomendada cada 90 días

### Input Validation
- Zod schemas en todas las API routes (TODO: implementar)
- Sanitización de texto: `sanitizeText()` en validators.ts
- SQL: Supabase usa queries parametrizadas (no SQL injection)
- Uploads: tipo de archivo y tamaño validados antes de guardar

### Rate Limiting
- Vercel tiene protección DDoS básica incluida
- Para rate limiting por IP: considerar Vercel Edge Middleware o Upstash

---

## Datos sensibles

### Tarjetas de crédito
- Los números de tarjeta **NUNCA se almacenan** en nuestra DB
- Se envían directo a MIO API server-side
- MIO maneja PCI DSS compliance

### Comprobantes de transferencia
- Almacenados en Supabase Storage bucket `comprobantes` (privado)
- Auto-delete después de 90 días
- Solo accesible vía URL firmada (generada server-side)

### Contraseñas admin
- Gestionadas por Supabase Auth (bcrypt + salting)
- Nunca las guardamos nosotros

---

## Secrets Management

| Secret | Ubicación | Rotación |
|--------|-----------|---------|
| SUPABASE_SERVICE_ROLE_KEY | Vercel env vars | 90 días |
| MIO_API_SECRET | Vercel env vars | 90 días |
| TWILIO_AUTH_TOKEN | Vercel env vars | 90 días |
| KDS_WEBHOOK_SECRET | Vercel env vars | Al cambiar |

---

## Incident Response

Si detectas un problema de seguridad:

1. **Contener**: Desactivar el feature afectado desde admin settings
2. **Evaluar**: ¿Datos expuestos? ¿Acceso no autorizado?
3. **Notificar**: Si hay datos de clientes comprometidos, avisar en 72h
4. **Corregir**: Hotfix → deploy vía workflow prod
5. **Post-mortem**: Documentar en /docs

---

## Checklist pre-deploy

- [ ] No hay `console.log` con datos sensibles
- [ ] Variables de entorno correctamente configuradas
- [ ] RLS activo en todas las tablas nuevas
- [ ] Inputs validados server-side
- [ ] No hay secrets hardcodeados en el código
- [ ] Dependencias auditadas: `npm audit`
