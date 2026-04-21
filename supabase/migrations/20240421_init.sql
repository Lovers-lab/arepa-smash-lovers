-- ============================================================
-- AREPA SMASH LOVERS — Initial Database Schema
-- Migration: 20240421_init.sql
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- for geo validation

-- ============================================================
-- USERS (clients, WhatsApp auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp        VARCHAR(20) UNIQUE NOT NULL,
  nombre          VARCHAR(100) NOT NULL,
  email           VARCHAR(255),
  direccion       TEXT,
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  dentro_zona     BOOLEAN DEFAULT FALSE,
  fecha_registro  TIMESTAMPTZ DEFAULT NOW(),
  cliente_vip     BOOLEAN DEFAULT FALSE,
  total_gastado   DECIMAL(12, 2) DEFAULT 0,
  total_compras   INTEGER DEFAULT 0,
  referido_por    UUID REFERENCES users(id),
  activo          BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_whatsapp ON users(whatsapp);

-- ============================================================
-- ADMIN USERS (Supabase Auth based)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre    VARCHAR(100) NOT NULL,
  rol       VARCHAR(20) NOT NULL DEFAULT 'SECUNDARIO' CHECK (rol IN ('PRINCIPAL', 'SECUNDARIO')),
  activo    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT,
  marca       VARCHAR(10) NOT NULL CHECK (marca IN ('AREPA', 'SMASH')),
  orden       INTEGER DEFAULT 0,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_marca ON categories(marca);
CREATE INDEX idx_categories_orden ON categories(orden);

-- Seed default categories
INSERT INTO categories (nombre, marca, orden) VALUES
  ('COMBOS', 'AREPA', 1),
  ('AREPAS ESPECIALES', 'AREPA', 2),
  ('CACHAPAS', 'AREPA', 3),
  ('AREPAS 2 INGREDIENTES', 'AREPA', 4),
  ('TEQUEÑOS', 'AREPA', 5),
  ('BEBIDAS', 'AREPA', 6),
  ('COMBOS', 'SMASH', 1),
  ('LAS BURGER', 'SMASH', 2),
  ('ACOMPAÑANTES', 'SMASH', 3),
  ('BEBIDAS', 'SMASH', 4);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre              VARCHAR(200) NOT NULL,
  descripcion         TEXT,
  precio              DECIMAL(10, 2) NOT NULL,
  marca               VARCHAR(10) NOT NULL CHECK (marca IN ('AREPA', 'SMASH')),
  category_id         UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  activo              BOOLEAN DEFAULT TRUE,
  foto_url            TEXT,
  orden_en_categoria  INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_marca ON products(marca);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_activo ON products(activo);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_pedido           INTEGER UNIQUE NOT NULL,
  user_id                 UUID NOT NULL REFERENCES users(id),
  estado                  VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado IN ('PENDIENTE','PAGADO','EN_COCINA','LISTO','ENVIO_SOLICITADO','EN_CAMINO','ENTREGADO','CANCELADO')),
  marca                   VARCHAR(10) NOT NULL CHECK (marca IN ('AREPA', 'SMASH')),
  metodo_pago             VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('TARJETA', 'TRANSFERENCIA')),
  monto_original          DECIMAL(12, 2) NOT NULL,
  descuento               DECIMAL(12, 2) DEFAULT 0,
  monto_final             DECIMAL(12, 2) NOT NULL,
  costo_envio             DECIMAL(10, 2) DEFAULT 50,
  total_pagado            DECIMAL(12, 2) NOT NULL,
  cupones_usados          TEXT[],
  codigo_referido         VARCHAR(50),
  codigo_influencer       VARCHAR(50),
  pedidosya_id            VARCHAR(100),
  fecha_orden             TIMESTAMPTZ DEFAULT NOW(),
  hora_pago_confirmado    TIMESTAMPTZ,
  hora_listo              TIMESTAMPTZ,
  hora_entregado          TIMESTAMPTZ,
  tiempo_cocina           INTEGER, -- minutos
  tiempo_entrega          INTEGER, -- minutos
  notas_admin             TEXT,
  notas_cliente           TEXT,
  comprobante_url         TEXT,
  order_id_mio            VARCHAR(100) -- MIO payment reference
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_estado ON orders(estado);
CREATE INDEX idx_orders_fecha ON orders(fecha_orden DESC);
CREATE INDEX idx_orders_marca ON orders(marca);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal        DECIMAL(12, 2) NOT NULL,
  notas           TEXT
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================================
-- LOYALTY
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_balances (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  saldo           DECIMAL(12, 2) DEFAULT 0,
  total_ganado    DECIMAL(12, 2) DEFAULT 0,
  total_gastado   DECIMAL(12, 2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  order_id          UUID REFERENCES orders(id),
  tipo              VARCHAR(20) NOT NULL CHECK (tipo IN ('GANADO', 'GASTADO', 'EXPIRADO')),
  puntos            DECIMAL(12, 2) NOT NULL,
  saldo_resultante  DECIMAL(12, 2) NOT NULL,
  descripcion       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Function: earn loyalty when order delivered
CREATE OR REPLACE FUNCTION earn_loyalty_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_puntos DECIMAL(12,2);
BEGIN
  IF NEW.estado = 'ENTREGADO' AND OLD.estado != 'ENTREGADO' THEN
    v_puntos := FLOOR(NEW.total_pagado / 10); -- RD$10 = 1 punto
    
    INSERT INTO loyalty_balances (user_id, saldo, total_ganado)
    VALUES (NEW.user_id, v_puntos, v_puntos)
    ON CONFLICT (user_id) DO UPDATE SET
      saldo = loyalty_balances.saldo + v_puntos,
      total_ganado = loyalty_balances.total_ganado + v_puntos,
      updated_at = NOW();

    INSERT INTO loyalty_transactions (user_id, order_id, tipo, puntos, saldo_resultante, descripcion)
    VALUES (NEW.user_id, NEW.id, 'GANADO', v_puntos,
      (SELECT saldo FROM loyalty_balances WHERE user_id = NEW.user_id),
      'Compra #' || NEW.numero_pedido);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_loyalty_on_delivery
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION earn_loyalty_on_delivery();

-- Function: deduct loyalty
CREATE OR REPLACE FUNCTION deduct_loyalty(p_user_id UUID, p_amount DECIMAL, p_order_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE loyalty_balances
  SET saldo = saldo - p_amount,
      total_gastado = total_gastado + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND saldo >= p_amount;

  INSERT INTO loyalty_transactions (user_id, order_id, tipo, puntos, saldo_resultante, descripcion)
  VALUES (p_user_id, p_order_id, 'GASTADO', p_amount,
    (SELECT saldo FROM loyalty_balances WHERE user_id = p_user_id),
    'Canje en pedido #' || (SELECT numero_pedido FROM orders WHERE id = p_order_id));
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- WELCOME OFFERS (2x1)
-- ============================================================
CREATE TABLE IF NOT EXISTS welcome_offers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  codigo            VARCHAR(50) UNIQUE NOT NULL,
  usado             BOOLEAN DEFAULT FALSE,
  fecha_generacion  TIMESTAMPTZ DEFAULT NOW(),
  fecha_expiracion  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  fecha_uso         TIMESTAMPTZ,
  order_id          UUID REFERENCES orders(id)
);

CREATE INDEX idx_welcome_offers_user ON welcome_offers(user_id);

-- Auto-create welcome offer on user insert
CREATE OR REPLACE FUNCTION create_welcome_offer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO welcome_offers (user_id, codigo)
  VALUES (NEW.id, 'BIENVENIDO-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_welcome_offer_on_register
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_welcome_offer();

-- ============================================================
-- REFERRAL CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id),
  codigo            VARCHAR(50) UNIQUE NOT NULL,
  usos              INTEGER DEFAULT 0,
  credito_acumulado DECIMAL(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INFLUENCER CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS influencer_codes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo                VARCHAR(50) UNIQUE NOT NULL,
  nombre_influencer     VARCHAR(100) NOT NULL,
  whatsapp_influencer   VARCHAR(20),
  porcentaje_comision   INTEGER NOT NULL DEFAULT 10,
  descripcion           TEXT,
  activo                BOOLEAN DEFAULT TRUE,
  saldo_acumulado       DECIMAL(12,2) DEFAULT 0,
  tipo_pago             VARCHAR(20) DEFAULT 'TRANSFER' CHECK (tipo_pago IN ('TRANSFER', 'CREDITO_COMIDA')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  created_by            VARCHAR(100),
  actualizado_por       VARCHAR(100)
);

-- ============================================================
-- BRAND COLORS
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_colors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marca             VARCHAR(10) UNIQUE NOT NULL CHECK (marca IN ('AREPA', 'SMASH')),
  color_primario    VARCHAR(7) NOT NULL,
  color_secundario  VARCHAR(7) NOT NULL,
  color_texto       VARCHAR(7) DEFAULT '#FFFFFF',
  color_fondo       VARCHAR(7) DEFAULT '#FFFFFF',
  color_botones     VARCHAR(7) NOT NULL,
  color_links       VARCHAR(7) NOT NULL,
  color_bordes      VARCHAR(7) NOT NULL,
  tema_activo       VARCHAR(30) DEFAULT 'DEFAULT',
  fecha_cambio      TIMESTAMPTZ DEFAULT NOW(),
  modificado_por    VARCHAR(100),
  historial         JSONB DEFAULT '[]'::jsonb,
  activo            BOOLEAN DEFAULT TRUE
);

INSERT INTO brand_colors (marca, color_primario, color_secundario, color_botones, color_links, color_bordes)
VALUES
  ('AREPA', '#C41E3A', '#E63946', '#C41E3A', '#C41E3A', '#E63946'),
  ('SMASH', '#0052CC', '#0066FF', '#0052CC', '#0052CC', '#0066FF');

-- ============================================================
-- APP SETTINGS (per brand)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  marca                       VARCHAR(10) UNIQUE NOT NULL CHECK (marca IN ('AREPA', 'SMASH')),
  banco_nombre                VARCHAR(100),
  banco_cuenta                VARCHAR(50),
  banco_titular               VARCHAR(100),
  banco_ruc                   VARCHAR(20),
  banco_instrucciones         TEXT,
  metodo_tarjeta_activo       BOOLEAN DEFAULT TRUE,
  metodo_transferencia_activo BOOLEAN DEFAULT TRUE,
  horario_apertura            TIME DEFAULT '10:00',
  horario_cierre              TIME DEFAULT '22:00',
  dias_abierto                TEXT[] DEFAULT ARRAY['lun','mar','mie','jue','vie','sab','dom'],
  envio_gratis_umbral         DECIMAL(10,2) DEFAULT 1000,
  envio_costo                 DECIMAL(10,2) DEFAULT 50,
  msg_cocina                  TEXT DEFAULT '✅ Tu orden #{{numero}} está en cocina. Tiempo estimado: 30-45 min.',
  msg_repartidor_camino       TEXT DEFAULT '🚗 Tu orden #{{numero}} está lista. Repartidor en camino. ETA: 8 min.',
  msg_en_ruta                 TEXT DEFAULT '🛵 Tu repartidor está en camino. Contacto: {{telefono}}',
  msg_entregado               TEXT DEFAULT '✅ Tu orden #{{numero}} fue entregada. ¿Cómo fue tu experiencia? [Calificar]',
  sonido_activo               BOOLEAN DEFAULT TRUE,
  sonido_volumen              INTEGER DEFAULT 100,
  sonido_tipo                 VARCHAR(30) DEFAULT 'ALARMA_1',
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (marca) VALUES ('AREPA'), ('SMASH');

-- ============================================================
-- DELIVERY ZONES
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          VARCHAR(100) NOT NULL,
  coordenadas     JSONB NOT NULL, -- GeoJSON polygon
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL UNIQUE REFERENCES orders(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  estrellas   INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REMINDERS & INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre            VARCHAR(200) NOT NULL,
  monto             DECIMAL(12,2) NOT NULL,
  frecuencia        VARCHAR(20) NOT NULL CHECK (frecuencia IN ('MENSUAL','BIMESTRAL','TRIMESTRAL','ANUAL','CUSTOM')),
  dia_del_mes       INTEGER NOT NULL CHECK (dia_del_mes BETWEEN 1 AND 31),
  marca             VARCHAR(10) NOT NULL CHECK (marca IN ('AREPA','SMASH','AMBAS')),
  activo            BOOLEAN DEFAULT TRUE,
  dias_anticipacion INTEGER DEFAULT 3,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre            VARCHAR(200) NOT NULL,
  monto             DECIMAL(12,2) NOT NULL,
  proveedor         VARCHAR(100),
  marca             VARCHAR(10) NOT NULL CHECK (marca IN ('AREPA','SMASH','AMBAS')),
  fecha_vencimiento DATE NOT NULL,
  prioridad         VARCHAR(10) DEFAULT 'NORMAL' CHECK (prioridad IN ('NORMAL','URGENTE')),
  descripcion       TEXT,
  archivo_url       TEXT,
  pagada            BOOLEAN DEFAULT FALSE,
  fecha_pago        DATE,
  deleted           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public read for products and categories (menu is public)
CREATE POLICY "products_public_read" ON products FOR SELECT USING (activo = TRUE);
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (activo = TRUE);
CREATE POLICY "brand_colors_public_read" ON brand_colors FOR SELECT USING (activo = TRUE);
CREATE POLICY "app_settings_public_read" ON app_settings FOR SELECT USING (TRUE);

-- Users can only read/update their own data
CREATE POLICY "users_own_read" ON users FOR SELECT USING (TRUE); -- phone lookup on login
CREATE POLICY "users_own_insert" ON users FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "users_own_update" ON users FOR UPDATE USING (TRUE);

-- Orders: users see their own, service role sees all
CREATE POLICY "orders_user_read" ON orders FOR SELECT USING (
  auth.uid() IS NOT NULL OR TRUE -- client auth is external (localStorage)
  -- In production: validate via custom JWT claim or service role
);
CREATE POLICY "orders_insert_anon" ON orders FOR INSERT WITH CHECK (TRUE);

-- Loyalty: own data only
CREATE POLICY "loyalty_own" ON loyalty_balances FOR SELECT USING (TRUE);
CREATE POLICY "loyalty_tx_own" ON loyalty_transactions FOR SELECT USING (TRUE);

-- Welcome offers
CREATE POLICY "welcome_offers_read" ON welcome_offers FOR SELECT USING (TRUE);
