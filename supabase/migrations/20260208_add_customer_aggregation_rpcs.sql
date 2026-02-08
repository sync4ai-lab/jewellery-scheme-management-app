-- Add customer aggregation RPCs for faster customer portal loads
-- Safe to run multiple times

CREATE OR REPLACE FUNCTION get_customer_pulse_snapshot(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_today date := CURRENT_DATE;
BEGIN
  WITH enrollments AS (
    SELECT
      e.id,
      e.status,
      e.karat,
      e.commitment_amount,
      st.name AS scheme_name,
      st.duration_months,
      st.installment_amount
    FROM enrollments e
    JOIN scheme_templates st ON st.id = e.plan_id
    WHERE e.customer_id = p_customer_id
      AND (p_retailer_id IS NULL OR e.retailer_id = p_retailer_id)
  ),
  txns_period AS (
    SELECT
      t.id,
      t.amount_paid,
      t.grams_allocated_snapshot,
      t.paid_at,
      t.enrollment_id,
      t.txn_type
    FROM transactions t
    WHERE t.enrollment_id IN (SELECT id FROM enrollments)
      AND t.payment_status = 'SUCCESS'
      AND t.txn_type IN ('PRIMARY_INSTALLMENT', 'TOP_UP')
      AND t.paid_at >= p_start
      AND t.paid_at < p_end
    ORDER BY t.paid_at DESC
    LIMIT 100
  ),
  txns_all AS (
    SELECT
      t.amount_paid,
      t.grams_allocated_snapshot,
      t.enrollment_id
    FROM transactions t
    WHERE t.enrollment_id IN (SELECT id FROM enrollments)
      AND t.payment_status = 'SUCCESS'
      AND t.txn_type IN ('PRIMARY_INSTALLMENT', 'TOP_UP')
  ),
  dues AS (
    SELECT ebm.enrollment_id
    FROM enrollment_billing_months ebm
    WHERE ebm.enrollment_id IN (SELECT id FROM enrollments)
      AND ebm.primary_paid = false
      AND ebm.due_date >= v_today
  ),
  overdue AS (
    SELECT COUNT(*)::int AS overdue_count
    FROM enrollment_billing_months ebm
    WHERE ebm.enrollment_id IN (SELECT id FROM enrollments)
      AND ebm.primary_paid = false
      AND ebm.due_date < v_today
  )
  SELECT jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalCollections', COALESCE((SELECT SUM(amount_paid) FROM txns_all), 0),
      'goldAllocated', COALESCE((
        SELECT SUM(t.grams_allocated_snapshot)
        FROM txns_all t
        JOIN enrollments e ON e.id = t.enrollment_id
        WHERE e.karat IS NULL OR e.karat <> 'SILVER'
      ), 0),
      'silverAllocated', COALESCE((
        SELECT SUM(t.grams_allocated_snapshot)
        FROM txns_all t
        JOIN enrollments e ON e.id = t.enrollment_id
        WHERE e.karat = 'SILVER'
      ), 0),
      'duesOutstanding', COALESCE((
        SELECT SUM(COALESCE(e.commitment_amount, e.installment_amount, 0))
        FROM enrollments e
        WHERE e.id IN (SELECT enrollment_id FROM dues)
          AND e.status = 'ACTIVE'
      ), 0),
      'overdueCount', COALESCE((SELECT overdue_count FROM overdue), 0),
      'totalSchemeValue', COALESCE((
        SELECT SUM(COALESCE(e.commitment_amount, e.installment_amount, 0) * COALESCE(e.duration_months, 0))
        FROM enrollments e
      ), 0),
      'activeEnrollments', COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.status = 'ACTIVE'), 0),
      'currentRates', jsonb_build_object(
        'k18', (
          SELECT jsonb_build_object('rate', gr.rate_per_gram, 'validFrom', gr.effective_from)
          FROM gold_rates gr
          WHERE gr.karat = '18K'
            AND (p_retailer_id IS NULL OR gr.retailer_id = p_retailer_id)
          ORDER BY gr.effective_from DESC
          LIMIT 1
        ),
        'k22', (
          SELECT jsonb_build_object('rate', gr.rate_per_gram, 'validFrom', gr.effective_from)
          FROM gold_rates gr
          WHERE gr.karat = '22K'
            AND (p_retailer_id IS NULL OR gr.retailer_id = p_retailer_id)
          ORDER BY gr.effective_from DESC
          LIMIT 1
        ),
        'k24', (
          SELECT jsonb_build_object('rate', gr.rate_per_gram, 'validFrom', gr.effective_from)
          FROM gold_rates gr
          WHERE gr.karat = '24K'
            AND (p_retailer_id IS NULL OR gr.retailer_id = p_retailer_id)
          ORDER BY gr.effective_from DESC
          LIMIT 1
        ),
        'silver', (
          SELECT jsonb_build_object('rate', gr.rate_per_gram, 'validFrom', gr.effective_from)
          FROM gold_rates gr
          WHERE gr.karat = 'SILVER'
            AND (p_retailer_id IS NULL OR gr.retailer_id = p_retailer_id)
          ORDER BY gr.effective_from DESC
          LIMIT 1
        )
      )
    ),
    'transactions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'amount_paid', t.amount_paid,
        'grams_allocated_snapshot', t.grams_allocated_snapshot,
        'paid_at', t.paid_at,
        'enrollment_id', t.enrollment_id,
        'txn_type', t.txn_type,
        'scheme_name', e.scheme_name,
        'karat', e.karat
      ))
      FROM txns_period t
      JOIN enrollments e ON e.id = t.enrollment_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION get_customer_wallet_transactions(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_recent_limit int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH enrollments AS (
    SELECT
      e.id,
      e.karat,
      st.name AS scheme_name
    FROM enrollments e
    JOIN scheme_templates st ON st.id = e.plan_id
    WHERE e.customer_id = p_customer_id
      AND (p_retailer_id IS NULL OR e.retailer_id = p_retailer_id)
  ),
  txns_recent AS (
    SELECT
      t.id,
      t.amount_paid,
      t.grams_allocated_snapshot,
      t.paid_at,
      t.enrollment_id,
      t.txn_type,
      t.mode
    FROM transactions t
    WHERE t.enrollment_id IN (SELECT id FROM enrollments)
      AND t.payment_status = 'SUCCESS'
      AND t.txn_type IN ('PRIMARY_INSTALLMENT', 'TOP_UP')
    ORDER BY t.paid_at DESC
    LIMIT GREATEST(p_recent_limit, 1)
  ),
  txns_all AS (
    SELECT
      t.id,
      t.amount_paid,
      t.grams_allocated_snapshot,
      t.paid_at,
      t.enrollment_id,
      t.txn_type,
      t.mode
    FROM transactions t
    WHERE t.enrollment_id IN (SELECT id FROM enrollments)
      AND t.payment_status = 'SUCCESS'
      AND t.txn_type IN ('PRIMARY_INSTALLMENT', 'TOP_UP')
      AND t.paid_at >= p_start
      AND t.paid_at < p_end
    ORDER BY t.paid_at DESC
    LIMIT 500
  )
  SELECT jsonb_build_object(
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'amount_paid', t.amount_paid,
        'grams_allocated_snapshot', t.grams_allocated_snapshot,
        'paid_at', t.paid_at,
        'enrollment_id', t.enrollment_id,
        'txn_type', t.txn_type,
        'mode', t.mode,
        'scheme_name', e.scheme_name,
        'karat', e.karat
      ))
      FROM txns_recent t
      JOIN enrollments e ON e.id = t.enrollment_id
    ), '[]'::jsonb),
    'all', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'amount_paid', t.amount_paid,
        'grams_allocated_snapshot', t.grams_allocated_snapshot,
        'paid_at', t.paid_at,
        'enrollment_id', t.enrollment_id,
        'txn_type', t.txn_type,
        'mode', t.mode,
        'scheme_name', e.scheme_name,
        'karat', e.karat
      ))
      FROM txns_all t
      JOIN enrollments e ON e.id = t.enrollment_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
