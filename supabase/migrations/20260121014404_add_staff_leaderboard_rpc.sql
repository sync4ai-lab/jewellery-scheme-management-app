/*
  # Add Staff Leaderboard RPC Function

  ## Purpose
  Returns staff members ranked by performance metrics (enrollments and collections)

  ## Function
  - `get_staff_leaderboard(period_days int)`
  - Returns: staff id, full_name, enrollments_count, collections_amount
  - Ordered by enrollments_count DESC
*/

CREATE OR REPLACE FUNCTION get_staff_leaderboard(period_days int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  full_name text,
  enrollments_count bigint,
  collections_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.full_name,
    COALESCE(COUNT(DISTINCT s.id), 0) as enrollments_count,
    COALESCE(SUM(DISTINCT t.amount), 0) as collections_amount
  FROM user_profiles up
  LEFT JOIN schemes s ON s.enrolled_by = up.id
    AND s.created_at >= CURRENT_DATE - (period_days || ' days')::interval
  LEFT JOIN transactions t ON t.recorded_by = up.id
    AND t.paid_at >= CURRENT_DATE - (period_days || ' days')::interval
    AND t.payment_status = 'SUCCESS'
  WHERE up.role IN ('ADMIN', 'STAFF')
  GROUP BY up.id, up.full_name
  ORDER BY enrollments_count DESC, collections_amount DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_staff_leaderboard(int) TO authenticated;
