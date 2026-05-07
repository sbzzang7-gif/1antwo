export type Stock = {
  id: number;
  name: string;
  code?: string;
  buyPrice: number;
  currentPrice: number;
  qty: number;
  sector: string;
  previousClose?: number | null;
  priceChange?: number | null;
  priceChangeRate?: number | null;
  priceFetchedAt?: string;
  priceSource?: string;
  marketStatus?: string;
};

export type ReturnsData = {
  labels: string[];
  data: number[];
};

export type Financial = {
  per: number;
  pbr: number;
  roe: number;
  debt: number;
  rev: number[];
  op: number[];
  years: string[];
  desc: string;
};

export type UploadedFile = {
  id: string;
  name: string;
  url: string;
  uploadedAt: number;
  type?: string;
};

export type TextPost = {
  id: string;
  author: string;
  title: string;
  content: string;
  createdAt: number;
};

export type BoardPost = TextPost & {
  files?: UploadedFile[];
};

export type ReportComment = {
  id: string;
  author: string;
  content: string;
  createdAt: number;
};

export type PerformanceRecord = {
  id: string;
  year?: string;
  quarter?: string;
  revenue: number;
  opProfit: number;
  netProfit: number;
};

export type DashboardData = {
  portfolio: Stock[];
  returnsData: ReturnsData;
  financials: Record<string, Financial>;
  companyDocs: Record<string, UploadedFile[]>;
  companyNotes: Record<string, TextPost[]>;
  reports: Record<string, UploadedFile[]>;
  reportComments: Record<string, ReportComment[]>;
  presentations: UploadedFile[];
  announcements: TextPost[];
  boardPosts: BoardPost[];
  annualData: Record<string, PerformanceRecord[]>;
  quarterlyData: Record<string, PerformanceRecord[]>;
  updatedAt?: number;
};
