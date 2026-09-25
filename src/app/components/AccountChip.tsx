"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCurrentUser, isLoggedIn, type CurrentUser } from "../lib/auth";

// Shows the signed-in user's name (with their avatar, if they've set one)
// at the top of the page, linking to their profile/dashboard - or a plain
// "Sign in" link when signed out. Used in SiteHeader (every resource page)
// and HomeClient's own topbar, so account identity shows up the same way
// site-wide instead of each page inventing its own.
export default function AccountChip({ language = "English" }: { language?: "English" | "اردو" }) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchCurrentUser().then(setUser);
  }, []);

  const isUrdu = language === "اردو";

  if (!user) {
    return <Link href="/login" className="topbar-account-link">{isUrdu ? "سائن ان" : "Sign in"}</Link>;
  }

  const displayName = user.full_name || user.email.split("@")[0];
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";

  return (
    <Link href="/dashboard" className="account-chip">
      {user.avatar_data_url
        ? <img className="account-chip-avatar" src={user.avatar_data_url} alt="" />
        : <span className="account-chip-avatar account-chip-avatar-placeholder">{initial}</span>}
      <span className="account-chip-name">{displayName}</span>
    </Link>
  );
}
