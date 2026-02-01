import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// CRITICAL: Suppress AbortError at the module level
// This MUST run before any Supabase client is created
// The error comes from @supabase/gotrue-js using Web Locks API
// =====================================================
if (typeof window !== 'undefined') {
  // Suppress unhandled AbortError rejections globally
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.name === 'AbortError') {
      event.preventDefault();
      event.stopPropagation();
      // Silent suppression - this is expected during HMR/navigation
      return false;
    }
  });

  // Also suppress uncaught errors for AbortError
  window.addEventListener('error', (event) => {
    if (event.error?.name === 'AbortError' || event.message?.includes('AbortError')) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });
}

// Custom lock implementation that never aborts - prevents AbortError entirely
const noOpLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  // Simply execute the function without any locking
  return await fn();
};

// Direct client creation with lock disabled to prevent AbortError
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Disable the Web Locks API to prevent AbortError
    lock: noOpLock,
    // Use localStorage directly without locking
    flowType: 'implicit',
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

export type Database = {
  public: {
    Tables: {
      retailers: {
        Row: {
          id: string;
          business_name: string;
          contact_email: string | null;
          phone: string;
          address: string | null;
          gstin: string | null;
          settings: any;
          status: 'active' | 'suspended' | 'inactive';
          created_at: string;
          updated_at: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          retailer_id: string | null;
          role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
          full_name: string;
          phone: string | null;
          employee_id: string | null;
          joined_at: string;
          metadata: any;
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          retailer_id: string;
          user_id: string | null;
          customer_code: string;
          full_name: string;
          phone: string;
          email: string | null;
          date_of_birth: string | null;
          address: string | null;
          pan_number: string | null;
          aadhar_number: string | null;
          tags: string[];
          status: 'active' | 'inactive' | 'blocked';
          enrolled_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      gold_rates: {
        Row: {
          id: string;
          retailer_id: string;
          karat: '22K' | '24K' | '18K';
          rate_per_gram: number;
          valid_from: string;
          updated_by: string | null;
          notes: string | null;
          created_at: string;
        };
      };
      schemes: {
        Row: {
          id: string;
          retailer_id: string;
          customer_id: string;
          scheme_name: string;
          monthly_amount: number;
          duration_months: number;
          start_date: string;
          end_date: string;
          karat: '22K' | '24K' | '18K';
          status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
          total_paid: number;
          total_grams_allocated: number;
          installments_paid: number;
          enrolled_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          retailer_id: string;
          scheme_id: string;
          customer_id: string;
          transaction_type: 'INSTALLMENT' | 'BONUS' | 'ADJUSTMENT' | 'REDEMPTION';
          amount: number;
          payment_method: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
          payment_reference: string | null;
          gold_rate_id: string;
          rate_per_gram: number;
          grams_allocated: number;
          transaction_date: string;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
      };
      scheme_templates: {
        Row: {
          id: string;
          retailer_id: string;
          name: string;
          duration_months: number;
          installment_amount: number;
          bonus_percentage: number;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
      };
      incentive_rules: {
        Row: {
          id: string;
          retailer_id: string;
          rule_name: string;
          rule_type: 'PER_ENROLLMENT' | 'PER_INSTALLMENT' | 'CROSS_SELL';
          amount: number;
          is_active: boolean;
          created_at: string;
        };
      };
      staff_incentives: {
        Row: {
          id: string;
          retailer_id: string;
          staff_id: string;
          incentive_rule_id: string | null;
          reference_id: string | null;
          amount: number;
          earned_date: string;
          status: 'PENDING' | 'PAID' | 'CANCELLED';
          paid_at: string | null;
          created_at: string;
        };
      };
    };
  };
};
