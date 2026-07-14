"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { PawPrint } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PawPrint className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!session || (userRole && userRole !== role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PawPrint className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
