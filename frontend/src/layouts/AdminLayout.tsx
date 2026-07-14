"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import NotificationBell from "@/components/NotificationBell";
import HeaderProfileLink from "@/components/HeaderProfileLink";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { useAdminNotifications } from "@/hooks/useNotifications";
import ChatbotWidget from "@/components/ChatbotWidget";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { notifications, isLoading } = useAdminNotifications();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { full_name?: string; email?: string; avatar_url?: string } | null;
    },
  });

  const displayName = profile?.full_name ?? user?.email ?? "Staff";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 no-print">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground font-medium">Admin Panel</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell
                notifications={notifications}
                userId={user?.id}
                isLoading={isLoading}
              />
              <HeaderProfileLink
                href="/admin/profile"
                displayName={displayName}
                subtitle="Veterinary Staff"
                avatarUrl={profile?.avatar_url}
              />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">{children}</main>
        </div>
      </div>
      <ChatbotWidget />
    </SidebarProvider>
  );
}
