import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AcaMS - 학원 관리 시스템",
  description: "Academy Management System — 학원 운영 업무 디지털화",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
