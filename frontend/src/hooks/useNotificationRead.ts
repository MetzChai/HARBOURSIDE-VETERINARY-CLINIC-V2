"use client";

import { useCallback, useEffect, useState } from "react";

export function useNotificationRead(userId: string | undefined) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    async function loadReadStates() {
      if (!userId) {
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch("/api/notifications", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { readIds?: string[] };
          if (isSubscribed && Array.isArray(data.readIds)) {
            setReadIds(new Set(data.readIds));
          }
        }
      } catch (err) {
        console.error("Failed to load notification read state from server:", err);
      } finally {
        if (isSubscribed) setLoaded(true);
      }
    }

    loadReadStates();
    return () => {
      isSubscribed = false;
    };
  }, [userId]);

  const markRead = useCallback(
    async (id: string) => {
      setReadIds((prev) => new Set(prev).add(id));
      try {
        await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.error(`Failed to mark notification ${id} as read:`, err);
      }
    },
    []
  );

  const markAllRead = useCallback(
    async (ids: string[]) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      try {
        await fetch("/api/notifications/read-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids }),
        });
      } catch (err) {
        console.error("Failed to mark all notifications as read:", err);
      }
    },
    []
  );

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const unreadCount = useCallback(
    (ids: string[]) => ids.filter((id) => !readIds.has(id)).length,
    [readIds]
  );

  return { loaded, isRead, markRead, markAllRead, unreadCount };
}
