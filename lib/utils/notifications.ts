import { supabase } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationPayload = {
  retailerId: string;
  customerId: string;
  enrollmentId?: string | null;
  type: string;
  message: string;
  metadata?: Record<string, any>;
};

type NotificationOptions = {
  client?: SupabaseClient;
  skipRpc?: boolean;
  skipQueueFallback?: boolean;
  useServerEndpoint?: boolean;
  accessToken?: string | null;
};

export async function createNotification(payload: NotificationPayload, options: NotificationOptions = {}) {
  const { retailerId, customerId, enrollmentId, type, message, metadata } = payload;
  const client = options.client ?? supabase;

  if (options.useServerEndpoint) {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        body: JSON.stringify({
          retailerId,
          customerId,
          enrollmentId: enrollmentId ?? null,
          type,
          message,
          metadata: metadata ?? {},
        }),
      });

      if (res.ok) return;
    } catch (error) {
      console.warn('Notification API failed:', error);
    }

    if (options.skipQueueFallback) {
      return;
    }
  }

  if (!options.skipRpc) {
    try {
      const { error } = await client.rpc('create_notification', {
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
  }

  if (options.skipQueueFallback) {
    return;
  }

  try {
    const { error } = await client.from('notification_queue').insert({
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
    await client.from('notification_queue').insert({
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
