"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    let retries = 0;
    const maxRetries = 5;
    const retryDelay = 500;

    const handleAuth = async () => {
      try {
        let session = null;
        // Retry session fetch for a short period to handle race conditions
        while (retries < maxRetries && !session) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          session = data.session;
          if (!session) {
            retries++;
            await new Promise(res => setTimeout(res, retryDelay));
          }
        }
        if (!session) {
          setError("Session not found. Please login again.");
          setLoading(false);
          router.replace("/login");
          return;
        }

        // Fetch profile to determine role
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profileError) throw profileError;

        if (profile?.role === "ADMIN" || profile?.role === "STAFF") {
          router.replace("/pulse");
        } else {
          router.replace("/c/pulse");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "An unexpected error occurred during authentication.");
        setLoading(false);
      }
    };
    handleAuth();
    return () => { isMounted = false; };
  }, [router]);

  if (loading) return <p>Signing you in…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  return null;
}
