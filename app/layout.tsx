import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "잃않투 Dashboard",
  description: "Firebase 실시간 투자 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="dark">
      <body>{children}</body>
    </html>
  );
}
