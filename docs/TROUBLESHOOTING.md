# Troubleshooting

## Problemas comunes y soluciones

---

### App no carga — pantalla en blanco

**Síntomas:** El browser muestra pantalla blanca, nada en UI.

**Verificar:**
1. Abre DevTools → Console → busca el error
2. Revisa que `.env.local` existe con todas las variables
3. Verifica que Supabase URL y anon key son correctas

```bash
# Verifica variables
echo $NEXT_PUBLIC_SUPABASE_URL
```

---

### "relation does not exist" en Supabase

**Causa:** Las migraciones SQL no se ejecutaron.

**Solución:**
1. Ve a Supabase Dashboard → SQL Editor
2. Ejecuta `supabase/migrations/20240421_init.sql`
3. Ejecuta `supabase/migrations/20240422_helpers.sql`
4. Ejecuta `supabase/migrations/20240423_referrals_and_rls.sql`

---

### Admin login falla con credenciales correctas

**Verificar:**
```sql
-- En Supabase SQL Editor
SELECT id, nombre, rol, activo FROM admin_users;
```

Si la tabla está vacía:
```sql
-- Primero crea el usuario en Supabase Auth (Dashboard → Auth → Users)
-- Luego inserta con el UUID que te da:
INSERT INTO admin_users (id, nombre, rol, activo)
VALUES ('TU-UUID-AQUI', 'Tu Nombre', 'PRINCIPAL', true);
```

---

### Productos no aparecen en el menú

**Verificar:**
1. Los productos están en Supabase con `activo = true`
2. La categoría tiene `activo = true`
3. La marca del producto coincide con la marca seleccionada

```sql
SELECT p.nombre, p.activo, c.nombre as categoria, c.activo as cat_activa
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.marca = 'AREPA';
```

---

### Colores de marca no cambian en tiempo real

**Causa:** Supabase Realtime no está habilitado para `brand_colors`.

**Solución:**
1. Supabase Dashboard → Database → Replication
2. Agrega la tabla `brand_colors` a la publicación `supabase_realtime`

---

### Alertas sonoras no suenan en admin

**Causa:** Los browsers requieren interacción del usuario antes de reproducir audio.

**Solución:** El admin debe hacer clic en cualquier parte de la página al menos una vez antes de que lleguen pedidos. Esto es una limitación del browser (autoplay policy).

---

### Comanda PDF no se genera

**Causa:** `jspdf` no se cargó correctamente.

**Verificar en DevTools → Console:**
```
Uncaught Error: Cannot read properties of undefined (reading 'jsPDF')
```

**Solución:** La librería se carga dinámicamente (`import('jspdf')`). Asegúrate de que el usuario tiene conexión a internet o que jspdf está en las dependencias instaladas.

---

### Notificaciones WhatsApp no llegan

**Verificar:**
1. Variables `TWILIO_*` están configuradas en Vercel
2. El número de WhatsApp del cliente tiene el formato correcto (10 dígitos)
3. Twilio Sandbox está activo (para desarrollo)

**Log de Twilio:**
Twilio Console → Monitor → Logs → Messaging

---

### Upload de comprobante falla

**Causa:** Bucket de Storage no existe o no tiene permisos.

**Solución:**
1. Supabase Dashboard → Storage → New bucket
2. Nombre: `comprobantes`, Privacy: Private
3. Agrega política: Service role tiene acceso total

---

### Deploy a staging falla en CI

**Verificar:**
1. Los GitHub Secrets están configurados correctamente
2. El token de Vercel no está vencido
3. El branch `staging` tiene permisos en GitHub Actions

**Debug:** Ve a GitHub → Actions → el run fallido → expande el step con error

---

### Error "RLS policy violation"

**Causa:** Estás intentando escribir en una tabla con RLS activo desde el cliente directamente.

**Solución:** Todas las operaciones de escritura sensitivas deben ir vía API routes del servidor usando el `SUPABASE_SERVICE_ROLE_KEY`, no el anon key.

---

## Contactos

- **Infra / Supabase**: revisar logs en Supabase Dashboard → Logs
- **Deploy / Vercel**: Vercel Dashboard → Deployments → Functions tab
- **Pagos MIO**: soporte@mio.com.do
- **WhatsApp Twilio**: console.twilio.com
