import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Gates child routes behind an authenticated Supabase session.
 *
 * Important: nothing inside `children` is rendered (or even imported, when
 * combined with React.lazy on the child) until `getSession()` resolves AND
 * returns a valid session. If the check fails, we redirect to /login and
 * preserve the intended destination in router state.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Subscribe BEFORE getSession (per Supabase guidance) so we don't miss events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setChecked(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecked(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Until the auth check completes, render NOTHING from the protected tree.
  // This guarantees no admin UI / data flashes for unauthenticated visitors.
  if (!checked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}