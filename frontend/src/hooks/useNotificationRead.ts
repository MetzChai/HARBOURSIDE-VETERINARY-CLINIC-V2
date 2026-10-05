"use client";

import { useCallback, useEffect, useState } from "react";

const GLOBAL_KEY = "harbourside-notif-read-global";

function userKey(userId: string | undefined) {
  return userId ? `harbourside-notif-read-${userId}` : GLOBAL_KEY;
}

function getStoredReadIds(userId: string | undefined): Set<string> {
  if (typeof window === "undefined") return new Set();
  const set = new Set<string>();
  try {
    const rawGlobal = localStorage.getItem(GLOBAL_KEY);
    if (rawGlobal) {
      (JSON.parse(rawGlobal) as string[]).forEach((id) => set.add(id));
    }
    if (userId) {
      const rawUser = localStorage.getItem(userKey(userId));
      if (rawUser) {
        (JSON.parse(rawUser) as string[]).forEach((id) => set.add(id));
      }
    }
  } catch (_e) {}
  return set;
}

function persistReadIds(set: Set<string>, userId: string | undefined) {
  if (typeof window === "undefined") return;
  const list = Array.from(set);
  try {
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(list));
    if (userId) {
      localStorage.setItem(userKey(userId), JSON.stringify(list));
    }
  } catch (_e) {}
}

export function useNotificationRead(userId: string | undefined) {
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds(userId));
  const [loaded, setLoaded] = useState(true);

  useEffect(() => {
    const current = getStoredReadIds(userId);
    setReadIds((prev) => {
      const merged = new Set([...prev, ...current]);
      persistReadIds(merged, userId);
      return merged;
    });
    setLoaded(true);
  }, [userId]);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev).add(id);
        persistReadIds(next, userId);
        return next;
      });
    },
    [userId]
  );

  const markAllRead = useCallback(
    (ids: string[]) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        persistReadIds(next, userId);
        return next;
      });
    },
    [userId]
  );

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const unreadCount = useCallback(
    (ids: string[]) => ids.filter((id) => !readIds.has(id)).length,
    [readIds]
  );

  return { loaded, isRead, markRead, markAllRead, unreadCount };
}

