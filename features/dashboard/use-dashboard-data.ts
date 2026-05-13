"use client";

import { onValue, ref as dbRef, set } from "firebase/database";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dashboardRef, db, isFirebaseDatabaseConfigured } from "@/lib/firebase/client";
import { DEFAULT_DATA } from "@/lib/dashboard/default-data";
import type { DashboardData } from "@/types/dashboard";

const normalize = (data: Partial<DashboardData> | null): DashboardData => ({
  ...DEFAULT_DATA,
  ...data,
  tradeJournal: data?.tradeJournal || [],
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
  const [loading, setLoading] = useState(isFirebaseDatabaseConfigured);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(
    isFirebaseDatabaseConfigured ? "" : "Firebase Realtime Database 환경 변수가 설정되지 않았습니다.",
  );
  const [saveStatus, setSaveStatus] = useState("");
  const remoteUpdateRef = useRef(false);
  const initialLoadSettledRef = useRef(!isFirebaseDatabaseConfigured);

  useEffect(() => {
    if (!dashboardRef) return;
    const activeDashboardRef = dashboardRef;
    const timeout = window.setTimeout(() => {
      if (!initialLoadSettledRef.current) {
        initialLoadSettledRef.current = true;
        setLoading(false);
        setError("Firebase 데이터를 불러오지 못했습니다. 네트워크 연결과 Realtime Database URL을 확인해주세요.");
      }
    }, 10000);

    const unsubscribe = onValue(
      activeDashboardRef,
      (snapshot) => {
        const value = snapshot.val() as DashboardData | null;
        initialLoadSettledRef.current = true;
        remoteUpdateRef.current = true;
        setDataState(normalize(value || {}));
        setLoading(false);
        setError("");
        queueMicrotask(() => {
          remoteUpdateRef.current = false;
        });
      },
      (firebaseError) => {
        initialLoadSettledRef.current = true;
        setLoading(false);
        setError(`Firebase 데이터를 불러오지 못했습니다: ${firebaseError.message}`);
      },
    );
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!db) return;

    return onValue(dbRef(db, ".info/connected"), (snapshot) => {
      setConnected(Boolean(snapshot.val()));
    });
  }, []);

  const persist = useCallback(async (next: DashboardData | ((current: DashboardData) => DashboardData)) => {
    const resolved = typeof next === "function" ? next(data) : next;
    setDataState((current) => {
      return typeof next === "function" ? next(current) : next;
    });
    if (!isFirebaseDatabaseConfigured || !dashboardRef) {
      setError("Firebase Realtime Database 환경 변수가 설정되지 않아 저장할 수 없습니다.");
      return;
    }

    if (!remoteUpdateRef.current) {
      try {
        await set(dashboardRef, { ...resolved, updatedAt: Date.now() });
        setSaveStatus("동기화됨");
        setError("");
      } catch (firebaseError) {
        const message = firebaseError instanceof Error ? firebaseError.message : "알 수 없는 오류";
        setError(`Firebase 저장에 실패했습니다: ${message}`);
        setSaveStatus("저장 실패");
      }
      window.setTimeout(() => setSaveStatus(""), 2000);
    }
  }, [data]);

  const replaceFromBackup = useCallback(
    (partial: Partial<DashboardData>) => persist(normalize({ ...data, ...partial })),
    [data, persist],
  );

  return useMemo(
    () => ({ data, loading, connected, error, saveStatus, persist, replaceFromBackup }),
    [data, loading, connected, error, saveStatus, persist, replaceFromBackup],
  );
}
