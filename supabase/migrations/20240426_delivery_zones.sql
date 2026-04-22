-- ============================================================
-- Migration: 20240426_delivery_zones.sql
-- Delivery zones with map polygon coverage
-- ============================================================

DROP TABLE IF EXISTS delivery_zones CASCADE;

CREATE TABLE delivery_zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(100) NOT NULL DEFAULT 'Zona Principal',
  precio_envio  DECIMAL(10,2) NOT NULL DEFAULT 99,
  envio_gratis_umbral DECIMAL(10,2) NOT NULL DEFAULT 500,
  poligono      JSONB,
  centro_lat    DECIMAL(10,8) DEFAULT 18.4793,
  centro_lng    DECIMAL(10,8) DEFAULT -69.9318,
  zoom_inicial  INTEGER DEFAULT 13,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO delivery_zones (
  nombre, precio_envio, envio_gratis_umbral,
  centro_lat, centro_lng, zoom_inicial, activo, poligono
) VALUES (
  'Distrito Nacional - Zona de cobertura',
  99, 500,
  18.4793, -69.9318, 13, true,
  '[
    {"lat": 18.5020, "lng": -69.9800},
    {"lat": 18.5020, "lng": -69.8800},
    {"lat": 18.4500, "lng": -69.8800},
    {"lat": 18.4500, "lng": -69.9800}
  ]'::jsonb
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dz_public_read" ON delivery_zones FOR SELECT USING (true);
CREATE POLICY "dz_write" ON delivery_zones FOR ALL USING (true);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS direccion_texto TEXT,
  ADD COLUMN IF NOT EXISTS direccion_lat   DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS direccion_lng   DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS precio_envio    DECIMAL(10,2) DEFAULT 0;
