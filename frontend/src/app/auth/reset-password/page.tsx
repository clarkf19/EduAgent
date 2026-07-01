"use client";

// This page redirects to /auth with the token in the URL so the auth page can handle it.
// useSearchParams() must be wrapped in Suspense per Next.js App Router requirements.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordRedirect() {
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
        </div>
      }
    >
      <ResetPasswordRedirect />
    </Suspense>
  );
}
