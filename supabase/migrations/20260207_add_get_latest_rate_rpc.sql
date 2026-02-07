-- Create get_latest_rate RPC for customer/staff clients
-- Safe to run multiple times

CREATE OR REPLACE FUNCTION get_latest_rate(
  p_retailer uuid,
  p_karat text,
  p_time timestamptz DEFAULT now()
)
RETURNS gold_rates
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gr
  FROM gold_rates gr
  WHERE gr.retailer_id = p_retailer
    AND gr.karat = p_karat::karat_type
    AND gr.effective_from <= p_time
  ORDER BY gr.effective_from DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_latest_rate(uuid, text, timestamptz) TO authenticated;
