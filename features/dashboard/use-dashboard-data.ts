"use client";

import { onValue, ref as dbRef, set } from "firebase/database";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dashboardRef, db } from "@/lib/firebase/client";
import { DEFAULT_DATA } from "@/lib/dashboard/default-data";
import type { DashboardData } from "@/types/dashboard";

const normalize = (data: Partial<DashboardData> | null): DashboardData => ({
  ...DEFAULT_DATA,
  ...data,
  returnsData: data?.returnsData || { labels: [], data: [] },
  companyDocs: data?.companyDocs || {},
  companyNotes: data?.companyNotes || {},
  reports: data?.reports || {},
  reportComments: data?.reportComments || {},
  presentations: data?.presentations || [],
  announcements: data?.announcements || [],
  boardPosts: data?.boardPosts || [],
  annualData: data?.annualData || {},
  quarterlyData: data?.quarterlyData || {},
});

export function useDashboardData() {
  const [data, setDataState] = useState<DashboardData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onValue(
      dashboardRef,
      (snapshot) => {
        const value = snapshot.val() as DashboardData | null;
        if (!value) {
          set(dashboardRef, { ...DEFAULT_DATA, updatedAt: Date.now() });
          return;
        }
        remoteUpdateRef.current = true;
        setDataState(normalize(value));
        setLoading(false);
        queueMicrotask(() => {
          remoteUpdateRef.current = false;
        });
      },
      () => setLoading(false),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    return onValue(dbRef(db, ".info/connected"), (snapshot) => {
      setConnected(Boolean(snapshot.val()));
    });
  }, []);

  const persist = useCallback(async (next: DashboardData | ((current: DashboardData) => DashboardData)) => {
    const resolved = typeof next === "function" ? next(data) : next;
    setDataState((current) => {
      return typeof next === "function" ? next(current) : next;
    });
    if (!remoteUpdateRef.current) {
      await set(dashboardRef, { ...resolved, updatedAt: Date.now() });
      setSaveStatus("동기화됨");
      window.setTimeout(() => setSaveStatus(""), 2000);
    }
  }, [data]);

  const replaceFromBackup = useCallback(
    (partial: Partial<DashboardData>) => persist(normalize({ ...data, ...partial })),
    [data, persist],
  );

  return useMemo(
    () => ({ data, loading, connected, saveStatus, persist, replaceFromBackup }),
    [data, loading, connected, saveStatus, persist, replaceFromBackup],
  );
}
