"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { isClinicUser, type AppRole } from "@/lib/roles";

function portalPath(role: AppRole): string {
  return role === "owner" ? "/user" : "/admin";
}

export default function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: AppRole[];
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
    if (userRole && !allowedRoles.includes(userRole)) {
      router.replace(portalPath(userRole));
    }
  }, [loading, session, userRole, allowedRoles, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <BrandLogo size="lg" className="animate-pulse" />
      </div>
    );
  }

  if (!session || (userRole && !allowedRoles.includes(userRole))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <BrandLogo size="lg" className="animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}

export { isClinicUser, portalPath };
