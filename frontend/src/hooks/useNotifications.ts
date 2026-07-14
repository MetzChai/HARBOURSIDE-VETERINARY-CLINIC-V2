"use client";

import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { useAuth } from "@/hooks/useAuth";
import {
  buildAdminNotifications,
  buildOwnerNotifications,
  type NotificationItem,
} from "@/lib/notifications";

const REFETCH_MS = 60_000;

export function useOwnerNotifications(): { notifications: NotificationItem[]; isLoading: boolean } {
  const { user } = useAuth();

  const { data: vaccinations = [], isLoading: vaxLoading } = useQuery({
    queryKey: ["notif-vaccinations", user?.id],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await db
        .from("vaccinations")
        .select("*, pets(name)")
        .order("next_due", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as any[];
    },
  });

  const { data: appointments = [], isLoading: aptLoading } = useQuery({
    queryKey: ["notif-appointments", user?.id],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await db
        .from("appointments")
        .select("*, pets(name)")
        .order("date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as any[];
    },
  });

  const { data: dewormings = [], isLoading: dewLoading } = useQuery({
    queryKey: ["notif-dewormings", user?.id],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data, error } = await db
        .from("dewormings")
        .select("*, pets(name)")
        .order("next_due", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as any[];
    },
  });

  const notifications = buildOwnerNotifications({ vaccinations, appointments, dewormings });

  return {
    notifications,
    isLoading: vaxLoading || aptLoading || dewLoading,
  };
}

export function useAdminNotifications(): { notifications: NotificationItem[]; isLoading: boolean } {
  const { user } = useAuth();

  const { data: vaccinations = [], isLoading: vaxLoading } = useQuery({
    queryKey: ["admin-notif-vaccinations"],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data } = await db.from("vaccinations").select("*, pets(name)");
      return (data ?? []) as any[];
    },
  });

  const { data: appointments = [], isLoading: aptLoading } = useQuery({
    queryKey: ["admin-notif-appointments"],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data } = await db.from("appointments").select("*, pets(name), owners(name)");
      return (data ?? []) as any[];
    },
  });

  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ["admin-notif-inventory"],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data } = await db.from("inventory_items").select("*");
      return (data ?? []) as any[];
    },
  });

  const { data: dewormings = [], isLoading: dewLoading } = useQuery({
    queryKey: ["admin-notif-dewormings"],
    enabled: !!user,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      const { data } = await db.from("dewormings").select("*, pets(name)");
      return (data ?? []) as any[];
    },
  });

  const notifications = buildAdminNotifications({
    vaccinations,
    appointments,
    inventory,
    dewormings,
  });

  return {
    notifications,
    isLoading: vaxLoading || aptLoading || invLoading || dewLoading,
  };
}
