"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserSidebar } from "@/components/UserSidebar";
import ChatbotWidget from "@/components/ChatbotWidget";
import NotificationBell from "@/components/NotificationBell";
import HeaderProfileLink from "@/components/HeaderProfileLink";
import { useMyOwner } from "@/hooks/useOwnerData";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { useOwnerNotifications } from "@/hooks/useNotifications";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: owner } = useMyOwner();
  const { notifications, isLoading } = useOwnerNotifications();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("profiles")
        .select("avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { avatar_url?: string } | null;
    },
  });

  const displayName = owner?.name ?? user?.email ?? "Pet Owner";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <UserSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-brand-teal/20 bg-card px-4 no-print">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground font-medium">Pet Owner Portal</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell
                notifications={notifications}
                userId={user?.id}
                isLoading={isLoading}
              />
              <HeaderProfileLink
                href="/user/profile"
                displayName={displayName}
                subtitle="Pet Owner"
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
