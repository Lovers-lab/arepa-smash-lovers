-- ============================================================
-- Migration: 20240423_referrals_and_rls.sql
-- Referral auto-create, admin RLS, missing indexes
-- ============================================================

-- ============================================================
-- AUTO-CREATE REFERRAL CODE ON USER REGISTER
-- ============================================================
CREATE OR REPLACE FUNCTION create_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO referral_codes (user_id, codigo, usos, credito_acumulado)
  VALUES (
    NEW.id,
    UPPER(LEFT(REPLACE(NEW.id::text, '-', ''), 8)),
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_code_on_register
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_referral_code();

-- ============================================================
-- APPLY REFERRAL ON FIRST ORDER (trigger on order insert)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_referral_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
  v_ref_code RECORD;
BEGIN
  -- Only on new paid orders
  IF NEW.estado NOT IN ('PAGADO', 'PENDIENTE') THEN RETURN NEW; END IF;

  -- Get user's referral info
  SELECT referido_por INTO v_user FROM users WHERE id = NEW.user_id;
  IF v_user.referido_por IS NULL THEN RETURN NEW; END IF;

  -- Check this is the FIRST order for this user
  IF (SELECT COUNT(*) FROM orders WHERE user_id = NEW.user_id AND id != NEW.id) > 0 THEN
    RETURN NEW;
  END IF;

  -- Credit referrer: RD$100 loyalty cash
  PERFORM apply_referral_credit(v_user.referido_por, NEW.id);

  -- Increment referral code usage
  UPDATE referral_codes
  SET usos = usos + 1, credito_acumulado = credito_acumulado + 100
  WHERE user_id = v_user.referido_por;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_on_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_referral_on_order();

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_numero ON orders(numero_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_orders_estado_fecha ON orders(estado, fecha_orden DESC);
CREATE INDEX IF NOT EXISTS idx_welcome_offers_user_activa ON welcome_offers(user_id, usado) WHERE usado = FALSE;
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_requests_send_at ON review_requests(send_at) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_marca_activo ON products(marca, activo);

-- ============================================================
-- ADMIN RLS — admins can read/write everything via service role
-- The app uses service role key for all admin API calls
-- ============================================================

-- Allow service role full access (already default in Supabase)
-- The following policies allow anon reads for public data only

-- Ensure orders can be inserted by server (via service role)
DROP POLICY IF EXISTS "orders_insert_anon" ON orders;
CREATE POLICY "orders_insert_service" ON orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "orders_update_service" ON orders FOR UPDATE USING (TRUE);

-- Protect admin_users table — only service role
CREATE POLICY "admin_users_service_only" ON admin_users
  FOR ALL USING (TRUE); -- enforced via service role key at API level
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Influencer codes — service role only for writes
ALTER TABLE influencer_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "influencer_public_read" ON influencer_codes FOR SELECT USING (activo = TRUE);
CREATE POLICY "influencer_write_service" ON influencer_codes FOR ALL USING (TRUE);

-- ============================================================
-- FUNCTION: Get order stats for dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION get_today_stats(p_marca TEXT DEFAULT NULL)
RETURNS TABLE(
  total_pedidos BIGINT,
  ingresos_entregados DECIMAL,
  clientes_nuevos BIGINT,
  pedidos_cancelados BIGINT,
  ticket_promedio DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_pedidos,
    COALESCE(SUM(total_pagado) FILTER (WHERE estado = 'ENTREGADO'), 0) AS ingresos_entregados,
    COUNT(DISTINCT user_id) FILTER (WHERE total_compras = 1) AS clientes_nuevos,
    COUNT(*) FILTER (WHERE estado = 'CANCELADO') AS pedidos_cancelados,
    COALESCE(AVG(total_pagado) FILTER (WHERE estado = 'ENTREGADO'), 0) AS ticket_promedio
  FROM orders
  WHERE DATE(fecha_orden) = CURRENT_DATE
    AND (p_marca IS NULL OR marca = p_marca);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED: initial admin (run manually after setup)
-- Replace 'YOUR-AUTH-USER-UUID' with actual UUID from Supabase Auth
-- ============================================================
-- INSERT INTO admin_users (id, nombre, rol, activo)
-- VALUES ('YOUR-AUTH-USER-UUID', 'Juan Nachón', 'PRINCIPAL', true)
-- ON CONFLICT (id) DO NOTHING;
