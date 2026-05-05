import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { UserRoleProvider, type UserRole } from "@/contexts/UserRoleContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [checked, setChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolveAccess(s: Session | null) {
      if (!s) {
        if (mounted) { setSession(null); setChecked(true); }
        return;
      }

      const email = s.user.email ?? "";
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", s.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (data?.role === "admin" || data?.role === "content") {
        setSession(s);
        setRole(data.role as UserRole);
      } else if (email.endsWith("@mood-and-vibes.com")) {
        // GW user with no explicit row — default to content
        setSession(s);
        setRole("content");
      } else {
        setAuthError("Account not authorized for admin access.");
      }
      setChecked(true);
    }

    // onAuthStateChange fires INITIAL_SESSION on mount, covering the initial load.
    // Using getSession() alongside creates a race where resolveAccess runs twice
    // concurrently and can overwrite role state — listener alone is sufficient.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      resolveAccess(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authError) {
    return <Navigate to="/login" replace state={{ from: location.pathname, authError }} />;
  }

  if (!session || !role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <UserRoleProvider role={role}>{children}</UserRoleProvider>;
}