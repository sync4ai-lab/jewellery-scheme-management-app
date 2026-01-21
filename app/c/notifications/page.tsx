'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, CheckCircle, AlertCircle, Sparkles, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useCustomerAuth } from '@/lib/contexts/customer-auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Notification = {
  id: string;
  notification_type: string;
  message: string | null;
  template_key: string | null;
  payload: any;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  metadata: any | null;
  created_at: string;
};

export default function NotificationsPage() {
  const { customer } = useCustomerAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!customer) {
      router.push('/c/login');
      return;
    }

    loadNotifications();
  }, [customer, router]);

  async function loadNotifications() {
    if (!customer) return;

    try {
      const { data } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (data) {
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'DUE_REMINDER':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'PAYMENT_SUCCESS':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'RATE_UPDATE':
        return <Sparkles className="w-5 h-5 text-primary" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  }

  function getNotificationColor(type: string) {
    switch (type) {
      case 'DUE_REMINDER':
        return 'border-orange-200 bg-orange-50 dark:bg-orange-900/10';
      case 'PAYMENT_SUCCESS':
        return 'border-green-200 bg-green-50 dark:bg-green-900/10';
      case 'RATE_UPDATE':
        return 'border-primary/20 bg-primary/5';
      default:
        return 'border-blue-200 bg-blue-50 dark:bg-blue-900/10';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-xl gold-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-gold-50/10 to-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/c/schemes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">Your updates and reminders</p>
          </div>
        </div>

        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card key={notif.id} className={getNotificationColor(notif.notification_type)}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {getNotificationIcon(notif.notification_type)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">
                          {(notif.template_key || notif.notification_type)?.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-sm font-medium">
                          {notif.message ||
                           (notif.payload?.scheme_name
                             ? `Payment reminder for ${notif.payload.scheme_name}`
                             : 'Reminder')}
                        </p>
                      </div>
                      {notif.status === 'PENDING' && (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
                          New
                        </Badge>
                      )}
                    </div>

                    {(notif.payload || notif.metadata) && (notif.payload?.monthly_amount || notif.metadata?.monthly_amount) && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>Expected amount: ₹{(notif.payload?.monthly_amount || notif.metadata?.monthly_amount).toLocaleString()}</div>
                        {(notif.payload?.days_overdue || notif.metadata?.days_overdue) > 0 && (
                          <div className="text-orange-600 dark:text-orange-400">
                            Overdue by {notif.payload?.days_overdue || notif.metadata?.days_overdue} days
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(notif.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {notif.sent_at && (
                        <Badge variant="secondary" className="text-xs">
                          Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {notifications.length === 0 && (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            </Card>
          )}
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                About Notifications
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Payment due reminders sent every alternate day after due date</li>
                <li>• Payment success confirmations</li>
                <li>• Gold rate update alerts</li>
                <li>• WhatsApp & SMS notifications coming soon</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
