import { supabase } from '@/lib/supabase/client';

export type NotificationPayload = {
  retailerId: string;
  customerId: string;
  enrollmentId?: string | null;
  type: string;
  message: string;
  metadata?: Record<string, any>;
};

export async function createNotification(payload: NotificationPayload) {
  const { retailerId, customerId, enrollmentId, type, message, metadata } = payload;

  try {
    const { error } = await supabase.rpc('create_notification', {
      p_retailer_id: retailerId,
      p_customer_id: customerId,
      p_enrollment_id: enrollmentId ?? null,
      p_type: type,
      p_message: message,
      p_metadata: metadata ?? {},
    });

    if (!error) return;
  } catch (error) {
    console.warn('Notification RPC failed:', error);
  }

  try {
    const { error } = await supabase.from('notification_queue').insert({
      retailer_id: retailerId,
      customer_id: customerId,
      enrollment_id: enrollmentId ?? null,
      notification_type: type,
      message,
      status: 'PENDING',
      scheduled_for: new Date().toISOString(),
      channel: 'IN_APP',
      metadata: metadata ?? {},
    });

    if (!error) return;
  } catch (error) {
    console.warn('Notification insert with enrollment_id failed:', error);
  }

  try {
    await supabase.from('notification_queue').insert({
      retailer_id: retailerId,
      customer_id: customerId,
      notification_type: type,
      message,
      status: 'PENDING',
      scheduled_for: new Date().toISOString(),
      channel: 'IN_APP',
      metadata: metadata ?? {},
    });
  } catch (error) {
    console.warn('Notification insert failed:', error);
  }
}
