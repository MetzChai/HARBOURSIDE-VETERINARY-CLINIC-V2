"use client";

import { Bell, Syringe, Calendar, AlertTriangle, Package, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useNotificationRead } from "@/hooks/useNotificationRead";
import type { NotificationItem } from "@/lib/notifications";

export type { NotificationItem };

const iconMap = {
  vaccine: Syringe,
  appointment: Calendar,
  inventory: Package,
  alert: AlertTriangle,
};

const colorMap = {
  vaccine: "text-destructive bg-destructive/10",
  appointment: "text-amber-500 bg-amber-500/10",
  inventory: "text-blue-500 bg-blue-500/10",
  alert: "text-warning bg-warning/10",
};

interface Props {
  notifications: NotificationItem[];
  userId?: string;
  isLoading?: boolean;
}

export default function NotificationBell({ notifications, userId, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const { loaded, isRead, markRead, markAllRead, unreadCount } = useNotificationRead(userId);

  const notificationIds = notifications.map((n) => n.id);
  const unread = loaded ? unreadCount(notificationIds) : 0;

  const defaultLinkFor = (type: NotificationItem["type"]) => {
    if (isAdmin) {
      switch (type) {
        case "vaccine": return "/admin/care-history";
        case "appointment": return "/admin/schedule";
        case "inventory": return "/admin/inventory";
        case "alert": return "/admin";
      }
    }
    switch (type) {
      case "vaccine": return "/user/vaccinations";
      case "appointment": return "/user/appointments";
      default: return "/user";
    }
  };

  const handleClick = (n: NotificationItem) => {
    markRead(n.id);
    setOpen(false);
    router.push(n.link ?? defaultLinkFor(n.type));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] bg-destructive">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <p className="font-heading font-semibold text-sm">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Updating…" : `${unread} unread`}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead(notificationIds)}
              className="h-7 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {isLoading && notifications.length === 0 ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">
              You&apos;re all caught up — no alerts right now
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = iconMap[n.type];
                const read = loaded && isRead(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors ${
                      !read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${colorMap[n.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                    </div>
                    {!read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}