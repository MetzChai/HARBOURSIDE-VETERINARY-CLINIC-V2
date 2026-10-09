import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";

export function useRows<T = any>(
  table: string,
  opts?: { orderBy?: string; ascending?: boolean; select?: string }
) {
  const select = opts?.select ?? "*";
  const query = useQuery({
    queryKey: [table, select, opts?.orderBy, opts?.ascending],
    // Cap refetch fan-out (CareHistory fires 6 parallel queries) and avoid
    // retry storms when the /api/data proxy hiccups with ECONNRESET.
    staleTime: 30_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let q = db.from(table).select(select);
      if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? true });
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
