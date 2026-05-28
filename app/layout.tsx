import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
  description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로. AI가 단계별 설명과 자막까지 자동 생성합니다. Don't Explain, Just Mimic.",
  openGraph: {
    title: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
    description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로. AI가 단계별 설명과 자막까지 자동 생성합니다.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
    description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로. AI가 단계별 설명과 자막까지 자동 생성합니다.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
