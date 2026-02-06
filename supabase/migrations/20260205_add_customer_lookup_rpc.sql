-- RPC to lookup customer by phone for login (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.lookup_customer_by_phone(
  p_phone_candidates text[],
  p_retailer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  retailer_id uuid,
  full_name text,
  phone text,
  email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.retailer_id, c.full_name, c.phone, c.email
  FROM public.customers c
  WHERE (p_retailer_id IS NULL OR c.retailer_id = p_retailer_id)
    AND (
      c.phone = ANY(p_phone_candidates)
      OR c.phone ILIKE '%' || p_phone_candidates[1]
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_customer_by_phone(text[], uuid) TO anon, authenticated;
