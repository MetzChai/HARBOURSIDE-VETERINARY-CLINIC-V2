"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(userId: string) {
  return `harbourside-notif-read-${userId}`;
}

export function useNotificationRead(userId: string | undefined) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setReadIds(new Set());
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(userId));
      setReadIds(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
    } catch {
      setReadIds(new Set());
    }
    setLoaded(true);
  }, [userId]);

  const save = useCallback(
    (next: Set<string>) => {
      if (userId) {
        localStorage.setItem(storageKey(userId), JSON.stringify([...next]));
      }
      setReadIds(next);
    },
    [userId]
  );

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev).add(id);
        if (userId) {
          localStorage.setItem(storageKey(userId), JSON.stringify([...next]));
        }
        return next;
      });
    },
    [userId]
  );

  const markAllRead = useCallback(
    (ids: string[]) => {
      save(new Set(ids));
    },
    [save]
  );

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const unreadCount = useCallback(
    (ids: string[]) => ids.filter((id) => !readIds.has(id)).length,
    [readIds]
  );

  return { loaded, isRead, markRead, markAllRead, unreadCount };
}
