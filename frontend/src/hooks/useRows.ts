import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";

export type OrderOption = { column: string; ascending?: boolean };

export function useRows<T = any>(
  table: string,
  opts?: {
    orderBy?: string;
    ascending?: boolean;
    orders?: OrderOption[];
    select?: string;
    dateRange?: { column: string; from?: string; to?: string };
    staleTime?: number;
    refetchOnMount?: boolean | "always";
  }
) {
  const select = opts?.select ?? "*";
  const query = useQuery({
    queryKey: [table, select, opts?.orderBy, opts?.ascending, opts?.orders, opts?.dateRange],
    // Cap refetch fan-out (CareHistory fires 6 parallel queries) and avoid
    // retry storms when the /api/data proxy hiccups with ECONNRESET.
    staleTime: opts?.staleTime ?? 30_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnMount: opts?.refetchOnMount ?? true,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let q = db.from(table).select(select);
      if (opts?.dateRange) {
        q = q.dateRange(opts.dateRange.column, opts.dateRange.from, opts.dateRange.to);
      }
      if (opts?.orders && opts.orders.length > 0) {
        for (const ord of opts.orders) {
          q = q.order(ord.column, { ascending: ord.ascending ?? true });
        }
      } else if (opts?.orderBy) {
        q = q.order(opts.orderBy, { ascending: opts.ascending ?? true });
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    },
  });
  return query;
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (table: string) => {
    qc.invalidateQueries({ queryKey: [table] });
    if (table === "messages") {
      qc.invalidateQueries({ queryKey: ["notif-messages"] });
      qc.invalidateQueries({ queryKey: ["admin-notif-messages"] });
    }
  };
}
