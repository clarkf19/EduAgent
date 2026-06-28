"use client";

// This page redirects to /auth with the token in the URL so the auth page can handle it.
// This avoids duplicating the reset form logic.

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams?.get("token");
    if (token) {
      router.replace(`/auth?token=${encodeURIComponent(token)}`);
    } else {
      router.replace("/auth");
    }
  }, [router, searchParams]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      <p style={{ color: "var(--text-secondary)" }}>Redirecting to reset password form…</p>
    </div>
  );
}
