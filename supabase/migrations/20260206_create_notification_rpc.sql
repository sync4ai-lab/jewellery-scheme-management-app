-- RPC to create notifications (works for admin + customer flows)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_retailer_id uuid,
  p_customer_id uuid,
  p_enrollment_id uuid DEFAULT NULL,
  p_type notification_type,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_enrollment_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_queue'
      AND column_name = 'enrollment_id'
  ) INTO v_has_enrollment_id;

  IF v_has_enrollment_id THEN
    INSERT INTO public.notification_queue (
      retailer_id,
      customer_id,
      enrollment_id,
      notification_type,
      message,
      status,
      scheduled_for,
      channel,
      metadata
    ) VALUES (
      p_retailer_id,
      p_customer_id,
      p_enrollment_id,
      p_type,
      p_message,
      'PENDING',
      now(),
      'IN_APP',
      p_metadata
    );
  ELSE
    INSERT INTO public.notification_queue (
      retailer_id,
      customer_id,
      notification_type,
      message,
      status,
      scheduled_for,
      channel,
      metadata
    ) VALUES (
      p_retailer_id,
      p_customer_id,
      p_type,
      p_message,
      'PENDING',
      now(),
      'IN_APP',
      p_metadata
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, uuid, notification_type, text, jsonb) TO authenticated;
