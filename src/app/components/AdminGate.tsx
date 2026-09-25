"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "../lib/auth";

type Status = "checking" | "authorized" | "unauthorized";

// Like ProtectedRoute, but also requires is_admin - redirects signed-out
// visitors to /login and signed-in non-admins to / (not a 404/403 page:
// there's no reason to reveal that /admin exists to someone it doesn't
// apply to). The backend enforces this independently on every /admin/*
// call regardless of what this component does.
export default function AdminGate({ children }: { children: (user: CurrentUser) => React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((currentUser) => {
      if (cancelled) return;
      if (!currentUser) {
        setStatus("unauthorized");
        router.replace("/login?next=%2Fadmin");
        return;
      }
      if (!currentUser.is_admin) {
        setStatus("unauthorized");
        router.replace("/");
        return;
      }
      setUser(currentUser);
      setStatus("authorized");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "checking") {
    return (
      <main className="resource-page">
        <div className="protected-route-loading">Checking your session…</div>
      </main>
    );
  }

  if (status === "unauthorized" || !user) {
    return null;
  }

  return <>{children(user)}</>;
}
