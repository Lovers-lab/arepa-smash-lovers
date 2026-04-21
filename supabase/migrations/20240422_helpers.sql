-- ============================================================
-- Migration: 20240422_helpers.sql
-- Helper functions, review requests, admin secondary
-- ============================================================

-- ============================================================
-- REVIEW REQUESTS (schedule 30min after delivery)
-- ============================================================
CREATE TABLE IF NOT EXISTS review_requests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL UNIQUE REFERENCES orders(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  send_at     TIMESTAMPTZ NOT NULL,
  sent        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INCREMENT USER STATS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION increment_user_stats(p_user_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    total_gastado = total_gastado + p_amount,
    total_compras = total_compras + 1,
    cliente_vip   = CASE WHEN total_gastado + p_amount >= 10000 THEN TRUE ELSE cliente_vip END
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VALIDATE DELIVERY ZONE (simple point-in-polygon check)
-- ============================================================
CREATE OR REPLACE FUNCTION check_delivery_zone(p_lat DECIMAL, p_lng DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
  v_dentro BOOLEAN := FALSE;
  zone RECORD;
BEGIN
  -- Simplified: check if within any active zone bounding box
  -- In production: use PostGIS ST_Within with actual polygons
  FOR zone IN SELECT coordenadas FROM delivery_zones WHERE activo = TRUE LOOP
    -- Placeholder: assumes zones have bbox in JSONB as {minLat, maxLat, minLng, maxLng}
    IF (p_lat BETWEEN (zone.coordenadas->>'minLat')::DECIMAL AND (zone.coordenadas->>'maxLat')::DECIMAL)
      AND (p_lng BETWEEN (zone.coordenadas->>'minLng')::DECIMAL AND (zone.coordenadas->>'maxLng')::DECIMAL) THEN
      v_dentro := TRUE;
      EXIT;
    END IF;
  END LOOP;
  RETURN v_dentro;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REFERRAL: apply referral code on first order
-- ============================================================
CREATE OR REPLACE FUNCTION apply_referral_credit(p_referrer_user_id UUID, p_order_id UUID)
RETURNS void AS $$
DECLARE
  v_credito DECIMAL := 100; -- RD$100
BEGIN
  -- Add credit to referrer's loyalty balance
  INSERT INTO loyalty_balances (user_id, saldo, total_ganado)
  VALUES (p_referrer_user_id, v_credito, v_credito)
  ON CONFLICT (user_id) DO UPDATE SET
    saldo = loyalty_balances.saldo + v_credito,
    total_ganado = loyalty_balances.total_ganado + v_credito,
    updated_at = NOW();

  INSERT INTO loyalty_transactions (user_id, order_id, tipo, puntos, saldo_resultante, descripcion)
  VALUES (p_referrer_user_id, p_order_id, 'GANADO', v_credito,
    (SELECT saldo FROM loyalty_balances WHERE user_id = p_referrer_user_id),
    'Crédito por referido');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INFLUENCER COMMISSION: accumulate on order delivery
-- ============================================================
CREATE OR REPLACE FUNCTION accumulate_influencer_commission(p_order_id UUID)
RETURNS void AS $$
DECLARE
  v_order RECORD;
  v_code RECORD;
  v_comision DECIMAL;
BEGIN
  SELECT codigo_influencer, total_pagado INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.codigo_influencer IS NULL THEN RETURN; END IF;

  SELECT id, porcentaje_comision INTO v_code FROM influencer_codes WHERE codigo = v_order.codigo_influencer AND activo = TRUE;
  IF v_code IS NULL THEN RETURN; END IF;

  v_comision := v_order.total_pagado * v_code.porcentaje_comision / 100;
  IF v_order.total_pagado < 1000 THEN v_comision := v_order.total_pagado * 0.05; END IF;

  UPDATE influencer_codes SET saldo_acumulado = saldo_acumulado + v_comision WHERE id = v_code.id;
END;
$$ LANGUAGE plpgsql;

-- Run after each delivery
CREATE OR REPLACE FUNCTION handle_order_delivered()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'ENTREGADO' AND OLD.estado != 'ENTREGADO' THEN
    -- Calculate time metrics
    IF NEW.hora_pago_confirmado IS NOT NULL THEN
      UPDATE orders SET
        tiempo_cocina = EXTRACT(EPOCH FROM (NEW.hora_listo - NEW.hora_pago_confirmado)) / 60,
        tiempo_entrega = EXTRACT(EPOCH FROM (NEW.hora_entregado - COALESCE(NEW.hora_listo, NEW.hora_pago_confirmado))) / 60
      WHERE id = NEW.id;
    END IF;

    -- Influencer commission
    PERFORM accumulate_influencer_commission(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_delivered();

-- ============================================================
-- ADMIN SECONDARY ROLE: check permissions
-- ============================================================
-- Views for admin principal only
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  DATE(fecha_orden) AS fecha,
  COUNT(*) AS total_pedidos,
  SUM(total_pagado) FILTER (WHERE estado = 'ENTREGADO') AS ingresos,
  COUNT(*) FILTER (WHERE estado = 'CANCELADO') AS cancelados,
  AVG(total_pagado) FILTER (WHERE estado = 'ENTREGADO') AS ticket_promedio,
  marca
FROM orders
WHERE fecha_orden >= NOW() - INTERVAL '30 days'
GROUP BY DATE(fecha_orden), marca
ORDER BY fecha DESC;

-- ============================================================
-- SEED: Default delivery zone (Santo Domingo)
-- ============================================================
INSERT INTO delivery_zones (nombre, coordenadas, activo) VALUES (
  'Santo Domingo Este',
  '{"minLat": 18.45, "maxLat": 18.55, "minLng": -69.95, "maxLng": -69.80}'::jsonb,
  TRUE
) ON CONFLICT DO NOTHING;
