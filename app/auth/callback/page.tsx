"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseCustomer as supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/login");
        return;
      }

      // Fetch profile to determine role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

      if (profile?.role === "ADMIN" || profile?.role === "STAFF") {
        router.replace("/pulse");
      } else {
        router.replace("/c/pulse");
      }
    };

    handleAuth();
  }, [router]);

  return <p>Signing you in…</p>;
}
