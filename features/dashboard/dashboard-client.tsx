"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Fragment, FormEvent, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Building2,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadFirebaseFile, deleteFirebaseFile } from "@/hooks/use-firebase-upload";
import { fmt, newWithin36Hours, pctCalc } from "@/lib/utils";
import type { StockQuote } from "@/lib/stocks/price-provider";
import type { BoardPost, DashboardData, PerformanceRecord, Stock, TextPost, TradeJournalEntry, UploadedFile } from "@/types/dashboard";
import { useDashboardData } from "@/features/dashboard/use-dashboard-data";

type TabKey = "portfolio" | "analysis" | "presentations" | "notice" | "board";
type Patch = (current: DashboardData) => DashboardData;
type NaverPriceResponse = {
  prices?: Record<string, number | null>;
  quotes?: Record<string, StockQuote | null>;
};

const tabItems: Array<{ key: TabKey; href: string; label: string; icon: React.ReactNode }> = [
  { key: "portfolio", href: "/", label: "포트폴리오", icon: <BarIcon /> },
  { key: "analysis", href: "/analysis", label: "기업분석", icon: <Building2 className="h-4 w-4" /> },
  { key: "presentations", href: "/presentations", label: "발표자료", icon: <FolderOpen className="h-4 w-4" /> },
  { key: "notice", href: "/notice", label: "공지사항", icon: <Bell className="h-4 w-4" /> },
  { key: "board", href: "/board", label: "자유게시판", icon: <MessageSquare className="h-4 w-4" /> },
];

const categoryColors = [
  {
    dot: "bg-chart-1",
    badge: "border-chart-1/30 bg-chart-1/10 text-chart-1",
    row: "hover:bg-chart-1/5",
    chart: "hsl(var(--chart-1))",
  },
  {
    dot: "bg-chart-2",
    badge: "border-chart-2/30 bg-chart-2/10 text-chart-2",
    row: "hover:bg-chart-2/5",
    chart: "hsl(var(--chart-2))",
  },
  {
    dot: "bg-chart-3",
    badge: "border-chart-3/30 bg-chart-3/10 text-chart-3",
    row: "hover:bg-chart-3/5",
    chart: "hsl(var(--chart-3))",
  },
  {
    dot: "bg-chart-4",
    badge: "border-chart-4/30 bg-chart-4/10 text-chart-4",
    row: "hover:bg-chart-4/5",
    chart: "hsl(var(--chart-4))",
  },
  {
    dot: "bg-chart-5",
    badge: "border-chart-5/30 bg-chart-5/10 text-chart-5",
    row: "hover:bg-chart-5/5",
    chart: "hsl(var(--chart-5))",
  },
  {
    dot: "bg-primary",
    badge: "border-primary/30 bg-primary/10 text-primary",
    row: "hover:bg-primary/5",
    chart: "hsl(var(--primary))",
  },
  {
    dot: "bg-muted-foreground",
    badge: "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
    row: "hover:bg-muted/40",
    chart: "hsl(var(--muted-foreground))",
  },
];
const chartColors = categoryColors.map((color) => color.chart);
const positiveChartColor = "hsl(var(--trading-up))";
const revenueChartColor = "hsl(var(--chart-5))";
const operatingProfitChartColor = "hsl(var(--trading-up))";
const netProfitChartColor = "hsl(var(--chart-4))";
const marginChartColor = "hsl(var(--primary))";
const chartGridColor = "hsl(var(--border))";
const chartTextColor = "hsl(var(--muted-foreground))";
const chartTooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
};

function getCategoryColor(index: number) {
  return categoryColors[index % categoryColors.length];
}

function getReturnTone(value: number) {
  if (value > 0) {
    return {
      text: "text-trading-up",
      strongText: "font-number font-semibold tabular-nums text-trading-up",
      badge: "border-trading-up/30 bg-trading-up/10 text-trading-up",
      row: "",
    };
  }

  if (value < 0) {
    return {
      text: "text-trading-down",
      strongText: "font-number font-semibold tabular-nums text-trading-down",
      badge: "border-trading-down/30 bg-trading-down/10 text-trading-down",
      row: "",
    };
  }

  return {
    text: "text-muted-foreground",
    strongText: "font-number font-semibold tabular-nums text-muted-foreground",
    badge: "border-muted bg-muted text-muted-foreground",
    row: "",
  };
}

function formatSignedNumber(value: number) {
  return `${value > 0 ? "+" : ""}${fmt(value)}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function BarIcon() {
  return <span className="text-sm">▦</span>;
}

function DeleteConfirm({
  title,
  description = "삭제 후에는 되돌릴 수 없습니다.",
  onConfirm,
}: {
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>삭제</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type DashboardContextValue = ReturnType<typeof useDashboardData>;

const DashboardContext = createContext<DashboardContextValue | null>(null);

function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used inside DashboardShell.");
  }
  return context;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const dashboard = useDashboardData();
  const { data, loading, connected, saveStatus, replaceFromBackup } = dashboard;
  const pathname = usePathname();
  const [clock, setClock] = useState<Date | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setClock(new Date()), 0);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const newBadges = useMemo(() => {
    const analysis =
      Object.values(data.companyNotes).flat().some((item) => newWithin36Hours(item.createdAt)) ||
      Object.values(data.companyDocs).flat().some((item) => newWithin36Hours(item.uploadedAt)) ||
      Object.values(data.reports).flat().some((item) => newWithin36Hours(item.uploadedAt));
    return {
      analysis,
      presentations: data.presentations.some((item) => newWithin36Hours(item.uploadedAt)),
      notice: data.announcements.some((item) => newWithin36Hours(item.createdAt)),
      board: data.boardPosts.some((item) => newWithin36Hours(item.createdAt)),
    };
  }, [data]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `잃않투-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DashboardData>;
      await replaceFromBackup(parsed);
      window.alert("복원 완료! 모든 사용자에게 동기화됩니다.");
    } catch {
      window.alert("잘못된 파일 형식입니다.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  return (
    <DashboardContext.Provider value={dashboard}>
      <main className="flex min-h-screen flex-col bg-background text-foreground">
        {loading && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Firebase에 연결 중...</p>
          </div>
        )}

        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-3 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="text-xl font-extrabold">
              <span className="text-primary">잃않투</span> Dashboard
            </Link>
            <Badge className={connected ? "hidden bg-accent text-primary sm:inline-flex" : "hidden bg-destructive/10 text-destructive sm:inline-flex"}>
              {connected ? "● 실시간 동기화 중" : "● 오프라인"}
            </Badge>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" size="sm" onClick={exportData}>
              <Save className="h-3.5 w-3.5" />
              백업
            </Button>
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              복원
            </Button>
            <input ref={importRef} className="hidden" type="file" accept=".json" onChange={(event) => importData(event.target.files?.[0])} />
            <span className="min-w-16 text-xs text-primary">{saveStatus}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-muted-foreground sm:inline">
              {clock ? `${clock.getFullYear()}.${String(clock.getMonth() + 1).padStart(2, "0")}.${String(clock.getDate()).padStart(2, "0")}` : "0000.00.00"}
            </span>
            <span className="font-mono font-semibold">
              {clock
                ? `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}:${String(clock.getSeconds()).padStart(2, "0")}`
                : "00:00:00"}
            </span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary " />
          </div>
          </div>
        </header>

        <nav className="hidden border-b bg-card md:block">
          <div className="mx-auto flex max-w-[1440px] overflow-x-auto px-8">
            {tabItems.map((item) => {
            const hasNew = item.key !== "portfolio" && newBadges[item.key];
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
                {hasNew && <span className="h-2 w-2 animate-pulse rounded-full bg-destructive " />}
              </Link>
            );
            })}
          </div>
        </nav>

        <div className="mx-auto w-full max-w-[1440px] px-3 pb-24 pt-4 md:px-8 md:py-6">{children}</div>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
          <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
            {tabItems.map((item) => {
              const hasNew = item.key !== "portfolio" && newBadges[item.key];
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="max-w-full truncate">{item.label}</span>
                  {hasNew && <span className="absolute right-4 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />}
                </Link>
              );
            })}
          </div>
        </nav>

        <footer className="mt-auto hidden border-t px-4 py-4 text-center text-xs text-muted-foreground md:block">
          잃않투 Dashboard · Firebase 실시간 동기화 · 모든 변경사항이 공유됩니다
        </footer>
      </main>
    </DashboardContext.Provider>
  );
}

export function PortfolioPage() {
  const { data, persist } = useDashboard();
  return <PortfolioTab data={data} persist={persist} />;
}

export function PresentationsPage() {
  const { data, persist } = useDashboard();
  return <PresentationsTab data={data} persist={persist} />;
}

export function NoticePage() {
  const { data, persist } = useDashboard();
  return <NoticeTab data={data} persist={persist} />;
}

export function BoardPage() {
  const { data, persist } = useDashboard();
  return <BoardTab data={data} persist={persist} />;
}

export function AnalysisPage() {
  const { data, persist } = useDashboard();
  return <AnalysisTab data={data} persist={persist} />;
}

export function AnalysisCompanyPage({ company }: { company: string }) {
  const { data, persist } = useDashboard();
  const name = decodeURIComponent(company);

  if (!data.financials[name]) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CardTitle>기업을 찾을 수 없습니다</CardTitle>
          <p className="text-sm text-muted-foreground">기업 목록에서 다시 선택해주세요.</p>
          <Button asChild>
            <Link href="/analysis">기업 목록으로 이동</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <CompanyPanel name={name} data={data} persist={persist} />;
}

function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-normal md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-col items-start justify-between gap-3 space-y-0 p-4 sm:flex-row md:p-6">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div>}
      </CardHeader>
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function PortfolioTab({ data, persist }: { data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  const mounted = useMounted();
  const [activePortfolioSection, setActivePortfolioSection] = useState<"charts" | "journal">("charts");
  const [showAdd, setShowAdd] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [editingJournalEntry, setEditingJournalEntry] = useState<TradeJournalEntry | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => {
    const inv = data.portfolio.reduce((sum, stock) => sum + stock.buyPrice * stock.qty, 0);
    const cur = data.portfolio.reduce((sum, stock) => sum + stock.currentPrice * stock.qty, 0);
    const ret = cur - inv;
    const pct = inv > 0 ? ((ret / inv) * 100).toFixed(1) : "0.0";
    return { inv, cur, ret, pct };
  }, [data.portfolio]);

  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    data.portfolio.forEach((stock) => map.set(stock.sector, (map.get(stock.sector) || 0) + stock.currentPrice * stock.qty));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data.portfolio]);

  const returns = data.returnsData.labels.map((label, index) => ({
    label,
    value: data.returnsData.data[index],
  }));
  const returnValues = returns.map((item) => item.value);
  const returnsMin = Math.min(0, ...returnValues);
  const returnsMax = Math.max(0, ...returnValues);
  const returnsZeroOffset = returnsMax === returnsMin ? 50 : (returnsMax / (returnsMax - returnsMin)) * 100;

  const addStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const buyPrice = Number(form.get("buyPrice"));
    const currentPrice = Number(form.get("currentPrice"));
    const qty = Number(form.get("qty"));
    if (!name || !buyPrice || !currentPrice || !qty) return window.alert("필수 항목(*)을 입력해주세요.");
    await persist((current) => ({
      ...current,
      portfolio: [
        ...current.portfolio,
        {
          id: Date.now(),
          name,
          code: String(form.get("code") || "").trim(),
          buyPrice,
          currentPrice,
          qty,
          sector: String(form.get("sector") || "").trim() || "기타",
        },
      ],
    }));
    event.currentTarget.reset();
    setShowAdd(false);
  };

  const updateStock = async (stock: Stock, form: HTMLFormElement) => {
    const values = new FormData(form);
    const buyPrice = Number(values.get("buyPrice"));
    const currentPrice = Number(values.get("currentPrice"));
    const qty = Number(values.get("qty"));
    if (!buyPrice || !currentPrice || !qty) return window.alert("값을 모두 입력해주세요.");
    await persist((current) => ({
      ...current,
      portfolio: current.portfolio.map((item) =>
        item.id === stock.id
          ? { ...item, code: String(values.get("code") || "").trim(), buyPrice, currentPrice, qty }
          : item,
      ),
    }));
    setEditingId(null);
  };

  const refreshNaverPrices = async () => {
    const targets = data.portfolio.filter((stock) => stock.code?.trim());
    if (!targets.length) return window.alert("종목코드(6자리)가 입력된 종목이 없습니다.");
    setRefreshing(true);
    try {
      const response = await fetch(`/api/naver-price?codes=${targets.map((stock) => stock.code?.trim()).join(",")}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as NaverPriceResponse;
      let updated = 0;
      await persist((current) => ({
        ...current,
        portfolio: current.portfolio.map((stock) => {
          const code = stock.code?.trim() || "";
          const quote = json.quotes?.[code];
          const price = quote?.price ?? json.prices?.[code];
          if (price == null) return stock;
          updated += 1;
          if (!quote) return { ...stock, currentPrice: price };

          return {
            ...stock,
            currentPrice: price,
            previousClose: quote.previousClose,
            priceChange: quote.change,
            priceChangeRate: quote.changeRate,
            priceFetchedAt: quote.fetchedAt,
            priceSource: quote.source,
            marketStatus: quote.marketStatus,
          };
        }),
      }));
      if (updated === 0) throw new Error("갱신된 종목 없음");
    } catch (error) {
      console.error(error);
      window.alert("현재가 갱신에 실패했습니다. 종목코드를 확인해주세요.");
    } finally {
      setRefreshing(false);
    }
  };

  const addReturn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = `${form.get("year")}.${form.get("month")}`;
    const value = Number(form.get("value"));
    if (Number.isNaN(value)) return window.alert("수익률을 입력해주세요.");
    if (data.returnsData.labels.includes(label)) return window.alert("이미 해당 월 데이터가 있습니다.");
    await persist((current) => ({
      ...current,
      returnsData: {
        labels: [...current.returnsData.labels, label],
        data: [...current.returnsData.data, value],
      },
    }));
    event.currentTarget.reset();
    setShowReturn(false);
  };

  const openJournalForm = (entry?: TradeJournalEntry) => {
    setEditingJournalEntry(entry || null);
    setShowJournalForm(true);
  };

  const saveJournalEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tradeDate = String(form.get("tradeDate") || "").trim();
    const stockName = String(form.get("stockName") || "").trim();
    const buyPrice = Number(form.get("buyPrice"));
    const quantity = Number(form.get("quantity"));
    const finalSellPrice = Number(form.get("finalSellPrice"));
    const buyReason = String(form.get("buyReason") || "").trim();
    const sellReason = String(form.get("sellReason") || "").trim();

    if (!tradeDate || !stockName || !buyPrice || !quantity || !finalSellPrice || !buyReason || !sellReason) {
      return window.alert("필수 항목을 모두 입력해주세요.");
    }

    const now = Date.now();
    await persist((current) => {
      if (editingJournalEntry) {
        return {
          ...current,
          tradeJournal: current.tradeJournal.map((entry) =>
            entry.id === editingJournalEntry.id
              ? {
                  ...entry,
                  tradeDate,
                  stockName,
                  buyPrice,
                  quantity,
                  finalSellPrice,
                  buyReason,
                  sellReason,
                  updatedAt: now,
                }
              : entry,
          ),
        };
      }

      return {
        ...current,
        tradeJournal: [
          {
            id: now,
            tradeDate,
            stockName,
            buyPrice,
            quantity,
            finalSellPrice,
            buyReason,
            sellReason,
            createdAt: now,
          },
          ...current.tradeJournal,
        ],
      };
    });
    event.currentTarget.reset();
    setEditingJournalEntry(null);
    setShowJournalForm(false);
  };

  const sortedJournalEntries = [...data.tradeJournal].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate) || b.createdAt - a.createdAt);

  return (
    <div className="space-y-5">
      <PageHeader
        title="포트폴리오"
        description="보유 종목, 월별 수익률, 섹터 배분을 한 화면에서 관리합니다."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refreshNaverPrices} disabled={refreshing} className="text-muted-foreground">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              현재가 갱신
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />
              종목 추가
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="총 평가액" value={`₩${fmt(stats.cur)}`} />
        <StatCard label="총 수익률" value={`${Number(stats.pct) > 0 ? "+" : ""}${stats.pct}%`} tone={Number(stats.pct) >= 0 ? "positive" : "negative"} />
        <StatCard label="총 수익금" value={`${stats.ret >= 0 ? "+" : ""}₩${fmt(stats.ret)}`} tone={stats.ret >= 0 ? "positive" : "negative"} />
        <StatCard label="총 투자금" value={`₩${fmt(stats.inv)}`} />
      </div>

      <SectionCard title="보유 종목 현황" description={`${data.portfolio.length}개 종목`}>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>종목명</TableHead>
                  <TableHead className="hidden sm:table-cell">코드</TableHead>
                  <TableHead className="hidden sm:table-cell">매입가</TableHead>
                  <TableHead>현재가</TableHead>
                  <TableHead className="hidden sm:table-cell">수량</TableHead>
                  <TableHead>평가액</TableHead>
                  <TableHead>수익률</TableHead>
                  <TableHead className="hidden md:table-cell">수익금</TableHead>
                  <TableHead className="hidden md:table-cell">비중</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.portfolio.map((stock, index) => {
                  const rate = Number(pctCalc(stock.buyPrice, stock.currentPrice));
                  const profit = (stock.currentPrice - stock.buyPrice) * stock.qty;
                  const evalAmt = stock.currentPrice * stock.qty;
                  const weight = stats.cur > 0 ? ((evalAmt / stats.cur) * 100).toFixed(1) : "0.0";
                  const tone = getReturnTone(profit);
                  const priceTone = getReturnTone(stock.priceChange ?? 0);
                  const categoryColor = getCategoryColor(index);
                  return (
                    <Fragment key={stock.id}>
                      <TableRow key={stock.id} className={`${tone.row} ${categoryColor.row}`}>
                        <TableCell className="font-semibold">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${categoryColor.dot}`} />
                            <span>{stock.name}</span>
                            <Badge className={`border ${categoryColor.badge}`}>{stock.sector}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{stock.code}</TableCell>
                        <TableCell className="hidden sm:table-cell">₩{fmt(stock.buyPrice)}</TableCell>
                        <TableCell>
                          <div className={tone.strongText}>₩{fmt(stock.currentPrice)}</div>
                          {stock.priceChange != null && stock.priceChangeRate != null && (
                            <div className={`mt-1 text-xs ${priceTone.text}`}>
                              전일대비 {formatSignedNumber(stock.priceChange)} ({formatSignedPercent(stock.priceChangeRate)})
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{fmt(stock.qty)}주</TableCell>
                        <TableCell className="font-medium">₩{fmt(evalAmt)}</TableCell>
                        <TableCell className={tone.strongText}>{rate > 0 ? "+" : ""}{rate.toFixed(1)}%</TableCell>
                        <TableCell className={`hidden md:table-cell ${tone.text}`}>{profit > 0 ? "+" : ""}₩{fmt(profit)}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{weight}%</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingId(editingId === stock.id ? null : stock.id)}>수정</Button>
                            <DeleteConfirm
                              title="종목 삭제"
                              onConfirm={() => persist((current) => ({ ...current, portfolio: current.portfolio.filter((item) => item.id !== stock.id) }))}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                      {editingId === stock.id && (
                        <TableRow key={`${stock.id}-edit`} className="bg-card">
                          <TableCell colSpan={10}>
                            <form
                              className="flex flex-wrap items-center gap-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                updateStock(stock, event.currentTarget);
                              }}
                            >
                              <span className="min-w-16 text-xs text-muted-foreground">{stock.name}</span>
                              <Input name="code" defaultValue={stock.code} placeholder="종목코드" className="w-32" />
                              <Input name="buyPrice" type="number" defaultValue={stock.buyPrice} className="w-28" />
                              <Input name="currentPrice" type="number" defaultValue={stock.currentPrice} className="w-28" />
                              <Input name="qty" type="number" defaultValue={stock.qty} className="w-24" />
                              <Button size="sm">저장</Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {data.portfolio.length ? data.portfolio.map((stock, index) => {
              const evalAmt = stock.currentPrice * stock.qty;
              const profit = (stock.currentPrice - stock.buyPrice) * stock.qty;
              const weight = stats.cur > 0 ? ((evalAmt / stats.cur) * 100).toFixed(1) : "0.0";
              return (
                <StockMobileCard
                  key={stock.id}
                  stock={stock}
                  categoryColor={getCategoryColor(index)}
                  evalAmt={evalAmt}
                  profit={profit}
                  weight={weight}
                  editing={editingId === stock.id}
                  onEdit={() => setEditingId(editingId === stock.id ? null : stock.id)}
                  onCancel={() => setEditingId(null)}
                  onUpdate={(form) => updateStock(stock, form)}
                  onDelete={() => persist((current) => ({ ...current, portfolio: current.portfolio.filter((item) => item.id !== stock.id) }))}
                />
              );
            }) : <EmptyState>등록된 종목이 없습니다.</EmptyState>}
          </div>
      </SectionCard>

      <div className="flex w-full rounded-lg border bg-card p-1 sm:w-fit">
        <Button
          type="button"
          variant={activePortfolioSection === "charts" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActivePortfolioSection("charts")}
          className="flex-1 sm:flex-none"
        >
          차트
        </Button>
        <Button
          type="button"
          variant={activePortfolioSection === "journal" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActivePortfolioSection("journal")}
          className="flex-1 sm:flex-none"
        >
          매매일지
        </Button>
      </div>

      {activePortfolioSection === "charts" ? (
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <SectionCard
          title="포트폴리오 월별 수익률 추이"
          description="26.03~"
          action={
            <Button variant="outline" size="sm" onClick={() => setShowReturn(true)}>
              <Plus className="h-3.5 w-3.5" />
              월별 수익률
            </Button>
          }
        >
            <div className="h-64">
              {mounted && (
                <ResponsiveContainer width="100%" height={256} minWidth={0}>
                  <AreaChart data={returns.length ? returns : [{ label: "", value: 0 }]}>
                    <defs>
                      <linearGradient id="returnsSignedFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={positiveChartColor} stopOpacity={0.2} />
                        <stop offset={`${returnsZeroOffset}%`} stopColor={positiveChartColor} stopOpacity={0.08} />
                        <stop offset={`${returnsZeroOffset}%`} stopColor="hsl(var(--trading-down))" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="hsl(var(--trading-down))" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={chartTextColor} fontSize={11} />
                    <YAxis stroke={chartTextColor} fontSize={11} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as { label: string; value: number };
                        return (
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground">
                            <div className="text-xs text-muted-foreground">{item.label}</div>
                            <div className={item.value >= 0 ? "text-trading-up" : "text-trading-down"}>
                              {item.value > 0 ? "+" : ""}{item.value}%
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      dataKey="value"
                      stroke={positiveChartColor}
                      fill="url(#returnsSignedFill)"
                      fillOpacity={1}
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {returns.map((item) => {
                const tone = getReturnTone(item.value);
                return (
                  <Badge key={item.label} className={`border ${tone.badge}`}>
                    {item.label}: {item.value > 0 ? "+" : ""}{item.value}%
                  </Badge>
                );
              })}
            </div>
        </SectionCard>

        <SectionCard title="섹터별 자산 배분">
            <div className="h-72">
              {mounted && (
                <ResponsiveContainer width="100%" height={288} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={sectors}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={0}
                      stroke="none"
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {sectors.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} stroke="none" strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`₩${fmt(Number(value))}`, "평가액"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
        </SectionCard>
      </div>
      ) : (
        <SectionCard
          title="매매일지"
          description={`${data.tradeJournal.length}개 기록`}
          action={
            <Button size="sm" onClick={() => openJournalForm()}>
              <Plus className="h-3.5 w-3.5" />
              매매일지 추가
            </Button>
          }
        >
          <div className="hidden overflow-x-auto md:block">
            {sortedJournalEntries.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>매매일</TableHead>
                    <TableHead>종목명</TableHead>
                    <TableHead>매입가</TableHead>
                    <TableHead>수량</TableHead>
                    <TableHead>최종매도가</TableHead>
                    <TableHead>최종수익률</TableHead>
                    <TableHead className="min-w-48">매수 근거</TableHead>
                    <TableHead className="min-w-48">매도 근거</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedJournalEntries.map((entry) => {
                    const finalReturnRate = entry.buyPrice > 0 ? ((entry.finalSellPrice - entry.buyPrice) / entry.buyPrice) * 100 : 0;
                    const tone = getReturnTone(finalReturnRate);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{entry.tradeDate}</TableCell>
                        <TableCell className="font-semibold">{entry.stockName}</TableCell>
                        <TableCell className="font-number tabular-nums">₩{fmt(entry.buyPrice)}</TableCell>
                        <TableCell className="font-number tabular-nums">{fmt(entry.quantity)}주</TableCell>
                        <TableCell className="font-number tabular-nums">₩{fmt(entry.finalSellPrice)}</TableCell>
                        <TableCell className={tone.strongText}>{formatSignedPercent(finalReturnRate)}</TableCell>
                        <TableCell className="max-w-64 whitespace-normal break-words text-sm text-muted-foreground">{entry.buyReason}</TableCell>
                        <TableCell className="max-w-64 whitespace-normal break-words text-sm text-muted-foreground">{entry.sellReason}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openJournalForm(entry)}>
                              <Edit3 className="h-3.5 w-3.5" />
                              수정
                            </Button>
                            <DeleteConfirm
                              title="매매일지 삭제"
                              onConfirm={() => persist((current) => ({ ...current, tradeJournal: current.tradeJournal.filter((item) => item.id !== entry.id) }))}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>등록된 매매일지가 없습니다.</EmptyState>
            )}
          </div>
          <div className="space-y-3 md:hidden">
            {sortedJournalEntries.length ? sortedJournalEntries.map((entry) => (
              <TradeJournalMobileCard
                key={entry.id}
                entry={entry}
                onEdit={() => openJournalForm(entry)}
                onDelete={() => persist((current) => ({ ...current, tradeJournal: current.tradeJournal.filter((item) => item.id !== entry.id) }))}
              />
            )) : <EmptyState>등록된 매매일지가 없습니다.</EmptyState>}
          </div>
        </SectionCard>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>종목 추가</DialogTitle>
            <DialogDescription>종목명, 매입가, 현재가, 수량은 필수입니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addStock} className="space-y-4">
            <FormGrid>
              <Input name="name" placeholder="종목명 *" />
              <Input name="code" placeholder="종목코드" />
              <Input name="buyPrice" type="number" placeholder="매입가 *" />
              <Input name="currentPrice" type="number" placeholder="현재가 *" />
              <Input name="qty" type="number" placeholder="수량 *" />
              <Input name="sector" placeholder="섹터" />
            </FormGrid>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
              <Button>추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturn} onOpenChange={setShowReturn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>월별 수익률 추가</DialogTitle>
            <DialogDescription>이미 등록된 월은 중복 저장되지 않습니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addReturn} className="space-y-4">
            <FormGrid>
              <select name="year" className="h-10 rounded-md border border-input bg-background px-4 text-sm">
                <option value="26">2026</option>
                <option value="27">2027</option>
                <option value="28">2028</option>
              </select>
              <select name="month" className="h-10 rounded-md border border-input bg-background px-4 text-sm">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={String(month).padStart(2, "0")}>{month}월</option>
                ))}
              </select>
              <Input name="value" type="number" step="0.1" placeholder="수익률 (%)" className="sm:col-span-2" />
            </FormGrid>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/30 text-destructive hover:text-destructive sm:mr-auto"
                onClick={() =>
                  persist((current) => ({
                    ...current,
                    returnsData: {
                      labels: current.returnsData.labels.slice(0, -1),
                      data: current.returnsData.data.slice(0, -1),
                    },
                  }))
                }
              >
                마지막 삭제
              </Button>
              <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
              <Button>추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showJournalForm}
        onOpenChange={(open) => {
          setShowJournalForm(open);
          if (!open) setEditingJournalEntry(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingJournalEntry ? "매매일지 수정" : "매매일지 추가"}</DialogTitle>
            <DialogDescription>매매일, 종목명, 가격, 수량, 매수/매도 근거를 입력합니다.</DialogDescription>
          </DialogHeader>
          <form key={editingJournalEntry?.id || "new"} onSubmit={saveJournalEntry} className="space-y-4">
            <FormGrid>
              <Input name="tradeDate" type="date" defaultValue={editingJournalEntry?.tradeDate} required />
              <Input name="stockName" placeholder="종목명 *" defaultValue={editingJournalEntry?.stockName} required />
              <Input name="buyPrice" type="number" min="0" step="1" placeholder="매입가 *" defaultValue={editingJournalEntry?.buyPrice} required />
              <Input name="quantity" type="number" min="0" step="1" placeholder="수량 *" defaultValue={editingJournalEntry?.quantity} required />
              <Input
                name="finalSellPrice"
                type="number"
                min="0"
                step="1"
                placeholder="최종매도가 *"
                defaultValue={editingJournalEntry?.finalSellPrice}
                required
                className="sm:col-span-2"
              />
            </FormGrid>
            <div className="grid gap-3">
              <Textarea name="buyReason" placeholder="매수 근거 *" defaultValue={editingJournalEntry?.buyReason} required />
              <Textarea name="sellReason" placeholder="매도 근거 *" defaultValue={editingJournalEntry?.sellReason} required />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
              <Button>{editingJournalEntry ? "저장" : "추가"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-trading-up" : tone === "negative" ? "text-trading-down" : "";

  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-number text-xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </Card>
  );
}

function StockMobileCard({
  stock,
  categoryColor,
  evalAmt,
  profit,
  weight,
  editing,
  onEdit,
  onCancel,
  onUpdate,
  onDelete,
}: {
  stock: Stock;
  categoryColor: ReturnType<typeof getCategoryColor>;
  evalAmt: number;
  profit: number;
  weight: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate: (form: HTMLFormElement) => Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const rate = Number(pctCalc(stock.buyPrice, stock.currentPrice));
  const tone = getReturnTone(profit);
  const priceTone = getReturnTone(stock.priceChange ?? 0);

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${categoryColor.dot}`} />
            <h3 className="truncate font-semibold">{stock.name}</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className={`border ${categoryColor.badge}`}>{stock.sector}</Badge>
            {stock.code && <Badge className="border-border bg-card text-muted-foreground">{stock.code}</Badge>}
          </div>
        </div>
        <div className="text-right">
          <div className={tone.strongText}>{rate > 0 ? "+" : ""}{rate.toFixed(1)}%</div>
          <div className={`mt-1 text-xs ${tone.text}`}>{profit > 0 ? "+" : ""}₩{fmt(profit)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">현재가</div>
          <div className="mt-1 font-number font-semibold tabular-nums">₩{fmt(stock.currentPrice)}</div>
          {stock.priceChange != null && stock.priceChangeRate != null && (
            <div className={`mt-1 text-xs ${priceTone.text}`}>
              {formatSignedNumber(stock.priceChange)} ({formatSignedPercent(stock.priceChangeRate)})
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">평가액</div>
          <div className="mt-1 font-number font-semibold tabular-nums">₩{fmt(evalAmt)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">수량</div>
          <div className="mt-1">{fmt(stock.qty)}주</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">비중</div>
          <div className="mt-1">{weight}%</div>
        </div>
      </div>

      {editing && (
        <form
          className="mt-4 grid gap-2 rounded-lg border bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate(event.currentTarget);
          }}
        >
          <Input name="code" defaultValue={stock.code} placeholder="종목코드" />
          <div className="grid grid-cols-3 gap-2">
            <Input name="buyPrice" type="number" defaultValue={stock.buyPrice} />
            <Input name="currentPrice" type="number" defaultValue={stock.currentPrice} />
            <Input name="qty" type="number" defaultValue={stock.qty} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
            <Button size="sm">저장</Button>
          </div>
        </form>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit3 className="h-3.5 w-3.5" />
          수정
        </Button>
        <DeleteConfirm title="종목 삭제" onConfirm={onDelete} />
      </div>
    </div>
  );
}

function TradeJournalMobileCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TradeJournalEntry;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const finalReturnRate = entry.buyPrice > 0 ? ((entry.finalSellPrice - entry.buyPrice) / entry.buyPrice) * 100 : 0;
  const tone = getReturnTone(finalReturnRate);

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{entry.tradeDate}</div>
          <h3 className="mt-1 truncate font-semibold">{entry.stockName}</h3>
        </div>
        <div className={`shrink-0 text-right ${tone.strongText}`}>{formatSignedPercent(finalReturnRate)}</div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">매입가</div>
          <div className="mt-1 font-number font-semibold tabular-nums">₩{fmt(entry.buyPrice)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">수량</div>
          <div className="mt-1 font-number font-semibold tabular-nums">{fmt(entry.quantity)}주</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">최종매도가</div>
          <div className="mt-1 font-number font-semibold tabular-nums">₩{fmt(entry.finalSellPrice)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">매수 근거</div>
          <p className="mt-1 break-words leading-6">{entry.buyReason}</p>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">매도 근거</div>
          <p className="mt-1 break-words leading-6">{entry.sellReason}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit3 className="h-3.5 w-3.5" />
          수정
        </Button>
        <DeleteConfirm title="매매일지 삭제" onConfirm={onDelete} />
      </div>
    </div>
  );
}

function PresentationsTab({ data, persist }: { data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.name.match(/\.(pdf|pptx|ppt)$/i)) return window.alert("PDF 또는 PPTX 파일만 업로드 가능합니다.");
    if (file.size > 50 * 1024 * 1024) return window.alert("50MB 이하 파일만 업로드 가능합니다.");
    setUploading(true);
    try {
      const id = Date.now().toString();
      const ext = file.name.split(".").pop()?.toLowerCase() || "file";
      const url = await uploadFirebaseFile(`presentations/${id}`, file);
      await persist((current) => ({
        ...current,
        presentations: [...current.presentations, { id, name: file.name, url, uploadedAt: Date.now(), type: ext === "pdf" ? "pdf" : "pptx" }],
      }));
    } catch (error) {
      window.alert(`업로드 실패: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SectionCard
      title="발표자료"
      description={`${data.presentations.length}건`}
      action={
        <label>
          <Button asChild size="sm">
            <span><Upload className="h-3.5 w-3.5" />{uploading ? "업로드 중..." : "파일 업로드"}</span>
          </Button>
          <input className="hidden" type="file" accept=".pdf,.pptx,.ppt" onChange={(event) => upload(event.target.files?.[0])} />
        </label>
      }
    >
        <FileList
          empty="업로드된 발표자료가 없습니다."
          files={[...data.presentations].reverse()}
          onDelete={async (file) => {
            try { await deleteFirebaseFile(file.url); } catch {}
            await persist((current) => ({ ...current, presentations: current.presentations.filter((item) => item.id !== file.id) }));
          }}
        />
    </SectionCard>
  );
}

function NoticeTab({ data, persist }: { data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  return (
    <PostSection
      title="공지사항"
      empty="등록된 공지사항이 없습니다."
      posts={data.announcements}
      onCreate={(post) => persist((current) => ({ ...current, announcements: [post, ...current.announcements] }))}
      onDelete={(id) => persist((current) => ({ ...current, announcements: current.announcements.filter((post) => post.id !== id) }))}
      requireContent
    />
  );
}

function BoardTab({ data, persist }: { data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <PostSection
      title="자유게시판"
      empty="등록된 게시물이 없습니다."
      posts={data.boardPosts}
      onCreate={async (post) => {
        const postId = post.id;
        const uploaded: UploadedFile[] = [];
        for (const file of files) {
          const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const url = await uploadFirebaseFile(`boardFiles/${postId}/${id}`, file);
          uploaded.push({ id, name: file.name, url, type: file.name.split(".").pop()?.toLowerCase(), uploadedAt: Date.now() });
        }
        await persist((current) => ({ ...current, boardPosts: [{ ...post, files: uploaded }, ...current.boardPosts] }));
        setFiles([]);
      }}
      onDelete={(id) => persist((current) => ({ ...current, boardPosts: current.boardPosts.filter((post) => post.id !== id) }))}
      extraForm={
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <Button asChild variant="outline" size="sm">
              <span><Paperclip className="h-3.5 w-3.5" />{files.length ? `${files.length}개 선택됨` : "파일 첨부"}</span>
            </Button>
            <input
              className="hidden"
              type="file"
              multiple
              accept=".pdf,.md,.docx,.doc,.pptx,.xlsx,.png,.jpg,.jpeg"
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
          </label>
          {files.map((file, index) => (
            <Badge key={`${file.name}-${index}`} className="bg-secondary text-foreground">
              {file.name}
              <button className="ml-2 text-muted-foreground" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} type="button">×</button>
            </Badge>
          ))}
        </div>
      }
      renderPostExtra={(post) => (
        <FileList
          compact
          empty=""
          files={(post as BoardPost).files || []}
          onDelete={async (file) => {
            try { await deleteFirebaseFile(file.url); } catch {}
            await persist((current) => ({
              ...current,
              boardPosts: current.boardPosts.map((item) =>
                item.id === post.id ? { ...item, files: (item.files || []).filter((stored) => stored.id !== file.id) } : item,
              ),
            }));
          }}
        />
      )}
    />
  );
}

function PostSection({
  title,
  empty,
  posts,
  onCreate,
  onDelete,
  extraForm,
  renderPostExtra,
  requireContent,
}: {
  title: string;
  empty: string;
  posts: TextPost[];
  onCreate: (post: TextPost) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  extraForm?: React.ReactNode;
  renderPostExtra?: (post: TextPost) => React.ReactNode;
  requireContent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const author = String(form.get("author") || "").trim();
    const titleValue = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    if (!author) return window.alert("작성자를 입력해주세요.");
    if (!titleValue) return window.alert("제목을 입력해주세요.");
    if (requireContent && !content) return window.alert("내용을 입력해주세요.");
    await onCreate({ id: Date.now().toString(), author, title: titleValue, content, createdAt: Date.now() });
    event.currentTarget.reset();
    setOpen(false);
  };

  return (
    <>
    <SectionCard
      title={title}
      description={`${posts.length}건`}
      action={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          글쓰기
        </Button>
      }
    >
        {posts.length === 0 ? (
          <EmptyState>{empty}</EmptyState>
        ) : (
          <div className="divide-y">
            {posts.map((post, index) => {
              const isOpen = expanded[post.id];
              return (
                <article key={post.id} className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{String(posts.length - index).padStart(3, "0")}</span>
                        <h3 className="min-w-0 break-words font-semibold">{post.title}</h3>
                        {newWithin36Hours(post.createdAt) && <Badge className="bg-destructive/10 text-destructive">NEW</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">작성자 {post.author} · {new Date(post.createdAt).toLocaleString("ko-KR")}</div>
                    </div>
                    <div className="flex shrink-0 justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpanded((current) => ({ ...current, [post.id]: !isOpen }))}>
                        {isOpen ? "접기" : "더보기"}
                      </Button>
                      <DeleteConfirm title="글 삭제" onConfirm={() => onDelete(post.id)} />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 rounded-lg border bg-background p-3 text-sm leading-7 text-foreground">
                      <div className="whitespace-pre-wrap">{post.content}</div>
                      {renderPostExtra?.(post)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
    </SectionCard>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title} 글쓰기</DialogTitle>
          <DialogDescription>작성자와 제목을 입력해 게시합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <Input name="author" placeholder="작성자 *" />
            <Input name="title" placeholder="제목 *" />
          </FormGrid>
          <Textarea name="content" placeholder="내용을 입력하세요..." />
          {extraForm}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
            <Button>등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function FileList({
  files,
  empty,
  onDelete,
  compact,
}: {
  files: UploadedFile[];
  empty: string;
  onDelete: (file: UploadedFile) => Promise<void>;
  compact?: boolean;
}) {
  if (!files.length) return empty ? <EmptyState>{empty}</EmptyState> : null;
  return (
    <div className={compact ? "mt-3 flex flex-wrap gap-2" : "divide-y"}>
      {files.map((file) => (
        <div key={file.id} className={compact ? "flex items-center gap-2 rounded-md border bg-card px-3 py-2" : "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"}>
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{file.name}</div>
              <div className="text-xs text-muted-foreground">{new Date(file.uploadedAt).toLocaleDateString("ko-KR")} · {(file.type || "file").toUpperCase()}</div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button asChild size="sm">
              <a href={file.url} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" />
                보기
              </a>
            </Button>
            <DeleteConfirm title="파일 삭제" onConfirm={() => onDelete(file)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisTab({ data, persist }: { data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  const names = Object.keys(data.financials);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = names.filter((name) => !query || name.toLowerCase().includes(query.toLowerCase()));

  const addCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!name) return window.alert("기업명을 입력해주세요.");
    if (data.financials[name]) return window.alert("이미 존재하는 기업입니다.");
    await persist((current) => ({
      ...current,
      financials: { ...current.financials, [name]: { per: 0, pbr: 0, roe: 0, debt: 0, rev: [], op: [], years: [], desc: "" } },
    }));
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="기업분석" description="기업별 분석자료, 리포트, 실적 데이터를 관리합니다." />
      <SectionCard title="기업 목록" description={`${filtered.length}개 기업`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="기업명 검색..." className="pl-9" />
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />
              기업 추가
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((name) => {
              const hasNew =
                (data.companyNotes[name] || []).some((item) => newWithin36Hours(item.createdAt)) ||
                (data.companyDocs[name] || []).some((item) => newWithin36Hours(item.uploadedAt)) ||
                (data.reports[name] || []).some((item) => newWithin36Hours(item.uploadedAt));
              return (
                <Link
                  key={name}
                  href={`/analysis/${encodeURIComponent(name)}`}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:border-input hover:bg-secondary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-bold">{name}</div>
                    {hasNew && <Badge className="bg-destructive/10 text-destructive">NEW</Badge>}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div>분석자료 {(data.companyDocs[name] || []).length}건</div>
                    <div>리포트 {(data.reports[name] || []).length}건</div>
                  </div>
                </Link>
              );
            })}
          </div>
      </SectionCard>
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>기업 추가</DialogTitle>
            <DialogDescription>기업 상세 화면과 기본 실적 저장 공간을 생성합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addCompany} className="space-y-4">
            <Input name="name" placeholder="기업명 *" />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
              <Button>추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyPanel({ name, data, persist }: { name: string; data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  const docs = data.companyDocs[name] || [];
  const notes = data.companyNotes[name] || [];
  const reports = data.reports[name] || [];
  const annual = data.annualData[name] || [];
  const quarterly = data.quarterlyData[name] || [];

  return (
    <div className="space-y-5">
      <Card className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{name}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{data.financials[name]?.desc}</p>
          </div>
          <DeleteConfirm
            title="기업 삭제"
            description={`"${name}" 기업과 연결된 화면 데이터를 삭제합니다.`}
            onConfirm={() =>
              persist((current) => {
                const financials = { ...current.financials };
                delete financials[name];
                return { ...current, financials };
              })
            }
          />
        </div>
      </Card>
      <CompanyDocs name={name} docs={docs} notes={notes} persist={persist} />
      <CompanyReports name={name} reports={reports} data={data} persist={persist} />
      <PerformancePanel title="최근 5개년 실적" labelKey="year" records={annual} onAdd={(record) => persist((current) => upsertPerformance(current, "annualData", name, record, 5, "year"))} onDelete={(id) => persist((current) => removePerformance(current, "annualData", name, id))} />
      <PerformancePanel title="최근 8개 분기 실적" labelKey="quarter" records={quarterly} onAdd={(record) => persist((current) => upsertPerformance(current, "quarterlyData", name, record, 8, "quarter"))} onDelete={(id) => persist((current) => removePerformance(current, "quarterlyData", name, id))} />
    </div>
  );
}

function CompanyDocs({ name, docs, notes, persist }: { name: string; docs: UploadedFile[]; notes: TextPost[]; persist: (patch: Patch) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.name.match(/\.(pdf|md|docx|doc)$/i)) return window.alert("PDF, MD, Word 파일만 업로드 가능합니다.");
    if (file.size > 30 * 1024 * 1024) return window.alert("30MB 이하 파일만 업로드 가능합니다.");
    const id = Date.now().toString();
    const url = await uploadFirebaseFile(`companyDocs/${name}/${id}`, file);
    await persist((current) => ({
      ...current,
      companyDocs: { ...current.companyDocs, [name]: [...(current.companyDocs[name] || []), { id, name: file.name, url, uploadedAt: Date.now(), type: file.name.split(".").pop()?.toLowerCase() }] },
    }));
  };

  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const author = String(form.get("author") || "").trim();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    if (!author || !title || !content) return window.alert("작성자, 제목, 내용을 모두 입력해주세요.");
    await persist((current) => ({
      ...current,
      companyNotes: { ...current.companyNotes, [name]: [{ id: Date.now().toString(), author, title, content, createdAt: Date.now() }, ...(current.companyNotes[name] || [])] },
    }));
    event.currentTarget.reset();
    setOpen(false);
  };

  return (
    <>
    <SectionCard
      title="기업분석 자료"
      description={`글 ${notes.length} · 파일 ${docs.length}`}
      action={
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />글쓰기</Button>
          <label>
            <Button asChild size="sm"><span><Upload className="h-3.5 w-3.5" />파일 업로드</span></Button>
            <input className="hidden" type="file" accept=".pdf,.md,.docx,.doc" onChange={(event) => upload(event.target.files?.[0])} />
          </label>
        </>
      }
    >
        <FileList
          files={docs}
          empty="업로드된 파일이 없습니다."
          onDelete={async (file) => {
            try { await deleteFirebaseFile(file.url); } catch {}
            await persist((current) => ({ ...current, companyDocs: { ...current.companyDocs, [name]: (current.companyDocs[name] || []).filter((item) => item.id !== file.id) } }));
          }}
        />
        <div className="mt-4 divide-y border-t">
          {notes.length ? notes.map((note) => (
            <article key={note.id} className="py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold">{note.title}</h3>
                  <div className="mt-1 text-xs text-muted-foreground">작성자 {note.author} · {new Date(note.createdAt).toLocaleString("ko-KR")}</div>
                </div>
                <DeleteConfirm title="글 삭제" onConfirm={() => persist((current) => ({ ...current, companyNotes: { ...current.companyNotes, [name]: (current.companyNotes[name] || []).filter((item) => item.id !== note.id) } }))} />
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm leading-7 text-foreground">{note.content}</p>
            </article>
          )) : <div className="py-6 text-center text-sm text-muted-foreground">작성된 글이 없습니다.</div>}
        </div>
    </SectionCard>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>기업 노트 작성</DialogTitle>
          <DialogDescription>{name} 분석 노트를 작성합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={addNote} className="space-y-4">
          <FormGrid>
            <Input name="author" placeholder="작성자 *" />
            <Input name="title" placeholder="제목 *" />
          </FormGrid>
          <Textarea name="content" placeholder="내용을 입력하세요..." />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
            <Button>등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function CompanyReports({ name, reports, data, persist }: { name: string; reports: UploadedFile[]; data: DashboardData; persist: (patch: Patch) => Promise<void> }) {
  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.name.match(/\.pdf$/i)) return window.alert("PDF 파일만 업로드 가능합니다.");
    if (file.size > 20 * 1024 * 1024) return window.alert("20MB 이하 파일만 업로드 가능합니다.");
    const id = Date.now().toString();
    const url = await uploadFirebaseFile(`reports/${name}/${id}`, file);
    await persist((current) => ({
      ...current,
      reports: { ...current.reports, [name]: [...(current.reports[name] || []), { id, name: file.name, url, uploadedAt: Date.now(), type: "pdf" }] },
    }));
  };

  return (
    <SectionCard
      title="애널리스트 리포트"
      description={`${reports.length}건`}
      action={
        <label>
          <Button asChild size="sm"><span><Upload className="h-3.5 w-3.5" />리포트 업로드</span></Button>
          <input className="hidden" type="file" accept=".pdf" onChange={(event) => upload(event.target.files?.[0])} />
        </label>
      }
    >
        <FileList
          files={reports}
          empty="업로드된 리포트가 없습니다."
          onDelete={async (file) => {
            try { await deleteFirebaseFile(file.url); } catch {}
            await persist((current) => ({ ...current, reports: { ...current.reports, [name]: (current.reports[name] || []).filter((item) => item.id !== file.id) } }));
          }}
        />
        {reports.map((report) => (
          <ReportComments key={report.id} report={report} company={name} comments={data.reportComments[report.id] || []} persist={persist} />
        ))}
    </SectionCard>
  );
}

function ReportComments({ report, company, comments, persist }: { report: UploadedFile; company: string; comments: DashboardData["reportComments"][string]; persist: (patch: Patch) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const author = String(form.get("author") || "").trim();
    const content = String(form.get("content") || "").trim();
    if (!author || !content) return window.alert("작성자와 코멘트를 입력해주세요.");
    await persist((current) => ({ ...current, reportComments: { ...current.reportComments, [report.id]: [...(current.reportComments[report.id] || []), { id: Date.now().toString(), author, content, createdAt: Date.now() }] } }));
    event.currentTarget.reset();
  };
  return (
    <div className="border-t py-3">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>코멘트 {comments.length}</Button>
      {open && (
        <div className="mt-3 rounded-lg bg-background p-3">
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="flex justify-between gap-3 border-b pb-2">
                <div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
                  <div className="mt-1 text-xs text-muted-foreground">작성자 {comment.author} · {new Date(comment.createdAt).toLocaleString("ko-KR")} · {company}</div>
                </div>
                <DeleteConfirm title="코멘트 삭제" onConfirm={() => persist((current) => ({ ...current, reportComments: { ...current.reportComments, [report.id]: (current.reportComments[report.id] || []).filter((item) => item.id !== comment.id) } }))} />
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="mt-3 space-y-2">
            <Input name="author" placeholder="작성자 *" className="w-36" />
            <Textarea name="content" placeholder="코멘트를 입력하세요..." className="min-h-20" />
            <Button size="sm">등록</Button>
          </form>
        </div>
      )}
    </div>
  );
}

function PerformancePanel({
  title,
  labelKey,
  records,
  onAdd,
  onDelete,
}: {
  title: string;
  labelKey: "year" | "quarter";
  records: PerformanceRecord[];
  onAdd: (record: PerformanceRecord) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const chartData = records.map((record) => ({
    label: record[labelKey],
    revenue: record.revenue || 0,
    opProfit: record.opProfit || 0,
    netProfit: record.netProfit || 0,
    margin: record.revenue > 0 ? Number(((record.opProfit / record.revenue) * 100).toFixed(1)) : 0,
  }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = String(form.get("label") || "").trim();
    const revenue = Number(form.get("revenue"));
    const opProfit = Number(form.get("opProfit"));
    const netProfit = Number(form.get("netProfit"));
    if (!label || Number.isNaN(revenue) || Number.isNaN(opProfit) || Number.isNaN(netProfit)) return window.alert("모든 수치를 입력해주세요.");
    await onAdd({ id: Date.now().toString(), [labelKey]: label, revenue, opProfit, netProfit });
    event.currentTarget.reset();
    setOpen(false);
  };

  return (
    <>
    <SectionCard
      title={title}
      description="단위: 억원"
      action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />실적 추가</Button>}
    >
        {records.length ? (
          <>
            <div className="mb-4 h-64">
              {mounted && (
                <ResponsiveContainer width="100%" height={256} minWidth={0}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid stroke={chartGridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={chartTextColor} fontSize={11} />
                    <YAxis yAxisId="left" stroke={chartTextColor} fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke={marginChartColor} fontSize={11} tickFormatter={(value) => `${value}%`} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="매출액" fill={revenueChartColor} fillOpacity={0.68} animationEasing="linear" animationDuration={450} />
                    <Bar yAxisId="left" dataKey="opProfit" name="영업이익" fill={operatingProfitChartColor} fillOpacity={0.68} animationEasing="linear" animationDuration={450} />
                    <Bar yAxisId="left" dataKey="netProfit" name="순이익" fill={netProfitChartColor} fillOpacity={0.68} animationEasing="linear" animationDuration={450} />
                    <Line yAxisId="right" dataKey="margin" name="영업이익률(%)" stroke={marginChartColor} strokeWidth={2} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labelKey === "year" ? "연도" : "분기"}</TableHead>
                    <TableHead>매출액</TableHead>
                    <TableHead>영업이익</TableHead>
                    <TableHead>순이익</TableHead>
                    <TableHead>영업이익률</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const operatingTone = getReturnTone(record.opProfit);
                    const netTone = getReturnTone(record.netProfit);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-semibold">{record[labelKey]}</TableCell>
                        <TableCell>{fmt(record.revenue)}</TableCell>
                        <TableCell className={operatingTone.text}>{fmt(record.opProfit)}</TableCell>
                        <TableCell className={netTone.text}>{fmt(record.netProfit)}</TableCell>
                        <TableCell className={operatingTone.strongText}>{record.revenue > 0 ? ((record.opProfit / record.revenue) * 100).toFixed(1) : "-"}%</TableCell>
                        <TableCell><DeleteConfirm title="실적 데이터 삭제" onConfirm={() => onDelete(record.id)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {records.map((record) => (
                <PerformanceMobileCard key={record.id} record={record} labelKey={labelKey} onDelete={() => onDelete(record.id)} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState>입력된 실적 데이터가 없습니다.</EmptyState>
        )}
    </SectionCard>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title} 입력</DialogTitle>
          <DialogDescription>매출액, 영업이익, 순이익을 억원 단위로 입력합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <Input name="label" placeholder={labelKey === "year" ? "연도 (예: 2024)" : "분기 (예: 24Q1)"} />
            <Input name="revenue" type="number" placeholder="매출액" />
            <Input name="opProfit" type="number" placeholder="영업이익" />
            <Input name="netProfit" type="number" placeholder="순이익" />
          </FormGrid>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
            <Button>추가</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function PerformanceMobileCard({
  record,
  labelKey,
  onDelete,
}: {
  record: PerformanceRecord;
  labelKey: "year" | "quarter";
  onDelete: () => void | Promise<void>;
}) {
  const operatingTone = getReturnTone(record.opProfit);
  const netTone = getReturnTone(record.netProfit);
  const margin = record.revenue > 0 ? ((record.opProfit / record.revenue) * 100).toFixed(1) : "-";

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{record[labelKey]}</h3>
        <DeleteConfirm title="실적 데이터 삭제" onConfirm={onDelete} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">매출액</div>
          <div className="mt-1 font-number font-semibold tabular-nums">{fmt(record.revenue)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">영업이익률</div>
          <div className={`mt-1 ${operatingTone.strongText}`}>{margin}%</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">영업이익</div>
          <div className={`mt-1 ${operatingTone.text}`}>{fmt(record.opProfit)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">순이익</div>
          <div className={`mt-1 ${netTone.text}`}>{fmt(record.netProfit)}</div>
        </div>
      </div>
    </div>
  );
}

function upsertPerformance(current: DashboardData, target: "annualData" | "quarterlyData", company: string, record: PerformanceRecord, limit: number, labelKey: "year" | "quarter") {
  const records = [...(current[target][company] || [])];
  const label = record[labelKey];
  const existingIndex = records.findIndex((item) => item[labelKey] === label);
  if (existingIndex >= 0) records[existingIndex] = { ...records[existingIndex], ...record };
  else records.push(record);
  records.sort((a, b) => String(a[labelKey]).localeCompare(String(b[labelKey])));
  return { ...current, [target]: { ...current[target], [company]: records.slice(-limit) } };
}

function removePerformance(current: DashboardData, target: "annualData" | "quarterlyData", company: string, id: string) {
  return { ...current, [target]: { ...current[target], [company]: (current[target][company] || []).filter((record) => record.id !== id) } };
}
