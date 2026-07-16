"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";

export default function ProtectedRoute({
  role,
  children,
}: {
  role: "admin" | "owner";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, role: userRole, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (userRole && userRole !== role) {
      router.replace(userRole === "admin" ? "/admin" : "/user");
    }
  }, [loading, session, userRole, role, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <BrandLogo size="lg" className="animate-pulse" />
      </div>
    );
  }

  if (!session || (userRole && userRole !== role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <BrandLogo size="lg" className="animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
