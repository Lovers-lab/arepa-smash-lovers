-- ============================================================
-- Migration: 20240424_modifiers.sql
-- Product modifiers (combo options, extras, etc.)
-- ============================================================

-- ============================================================
-- MODIFIER GROUPS (ej: "Elige tu arepa", "Elige tu bebida")
-- ============================================================
CREATE TABLE IF NOT EXISTS modifier_groups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nombre       VARCHAR(100) NOT NULL,  -- "Elige tu arepa"
  requerido    BOOLEAN DEFAULT TRUE,   -- cliente DEBE elegir
  min_opciones INTEGER DEFAULT 1,      -- mínimo de selecciones
  max_opciones INTEGER DEFAULT 1,      -- máximo de selecciones
  orden        INTEGER DEFAULT 0,
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modifier_groups_product ON modifier_groups(product_id);

-- ============================================================
-- MODIFIER OPTIONS (ej: "Pollo y Queso Gouda", "Malta")
-- ============================================================
CREATE TABLE IF NOT EXISTS modifier_options (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  nombre      VARCHAR(100) NOT NULL,  -- "Pollo y Queso Gouda"
  precio_extra DECIMAL(10,2) DEFAULT 0, -- costo adicional (0 = incluido)
  activo      BOOLEAN DEFAULT TRUE,
  orden       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modifier_options_group ON modifier_options(group_id);

-- ============================================================
-- ORDER ITEM MODIFIERS (opciones elegidas por el cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id    UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id),
  modifier_option_id UUID NOT NULL REFERENCES modifier_options(id),
  group_nombre     VARCHAR(100) NOT NULL,  -- snapshot del nombre
  option_nombre    VARCHAR(100) NOT NULL,  -- snapshot del nombre
  precio_extra     DECIMAL(10,2) DEFAULT 0
);

CREATE INDEX idx_order_item_mods_item ON order_item_modifiers(order_item_id);

-- RLS
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;

-- Public read (needed for menu)
CREATE POLICY "modifier_groups_public_read" ON modifier_groups FOR SELECT USING (activo = TRUE);
CREATE POLICY "modifier_options_public_read" ON modifier_options FOR SELECT USING (activo = TRUE);
CREATE POLICY "modifier_groups_write" ON modifier_groups FOR ALL USING (TRUE);
CREATE POLICY "modifier_options_write" ON modifier_options FOR ALL USING (TRUE);
CREATE POLICY "order_item_mods_write" ON order_item_modifiers FOR ALL USING (TRUE);
