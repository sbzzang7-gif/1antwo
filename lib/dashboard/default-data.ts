import type { DashboardData } from "@/types/dashboard";

export const DEFAULT_DATA: DashboardData = {
  portfolio: [
    { id: 1, name: "삼성전자", code: "005930", buyPrice: 65000, currentPrice: 72000, qty: 100, sector: "반도체" },
    { id: 2, name: "SK하이닉스", code: "000660", buyPrice: 180000, currentPrice: 195000, qty: 30, sector: "반도체" },
    { id: 3, name: "NAVER", code: "035420", buyPrice: 350000, currentPrice: 380000, qty: 20, sector: "IT" },
    { id: 4, name: "카카오", code: "035720", buyPrice: 55000, currentPrice: 48000, qty: 50, sector: "IT" },
    { id: 5, name: "현대차", code: "005380", buyPrice: 230000, currentPrice: 255000, qty: 15, sector: "자동차" },
  ],
  returnsData: { labels: [], data: [] },
  financials: {
    삼성전자: {
      per: 12.3,
      pbr: 1.2,
      roe: 9.8,
      debt: 28.5,
      rev: [302231, 258935, 300870, 320150],
      op: [43377, 6567, 32720, 45800],
      years: ["2022", "2023", "2024", "2025"],
      desc: "글로벌 반도체 1위 기업. 메모리, 파운드리, 모바일, 디스플레이 사업 영위.",
    },
    SK하이닉스: {
      per: 8.5,
      pbr: 1.8,
      roe: 21.2,
      debt: 45.3,
      rev: [446216, 327533, 661792, 720000],
      op: [70050, -77430, 234870, 260000],
      years: ["2022", "2023", "2024", "2025"],
      desc: "HBM 시장 글로벌 1위. AI 반도체 수요 급증에 따른 실적 턴어라운드 달성.",
    },
  },
  companyDocs: {},
  companyNotes: {},
  reports: {},
  reportComments: {},
  presentations: [],
  announcements: [],
  boardPosts: [],
  annualData: {},
  quarterlyData: {},
};
