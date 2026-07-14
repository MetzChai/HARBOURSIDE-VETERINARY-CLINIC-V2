import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { useAuth } from "@/hooks/useAuth";

export function useMyOwner() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-owner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from("owners").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw new Error(error.message);
      return data as { name?: string; contact?: string } | null;
    },
  });
}

export function useMyPets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-pets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from("pets").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown[];
    },
  });
}

export function useMyAppointments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-appointments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("appointments")
        .select("*, pets(name)")
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown[];
    },
  });
}

export function useMyVaccinations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-vaccinations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("vaccinations")
        .select("*, pets(name)")
        .order("next_due", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown[];
    },
  });
}

export function useMyCareRecords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-care-records", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("care_records")
        .select("*, pets(name)")
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown[];
    },
  });
}
