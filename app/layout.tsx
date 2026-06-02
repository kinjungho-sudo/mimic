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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mimic-nine-ashen.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
    template: "%s | MIMIC",
  },
  description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로. AI가 단계별 설명과 자막까지 자동 생성합니다. Don't Explain, Just Mimic.",
  openGraph: {
    title: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
    description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로. AI가 단계별 설명과 자막까지 자동 생성합니다.",
    type: "website",
    url: APP_URL,
    siteName: "MIMIC",
    locale: "ko_KR",
    images: [
      {
        url: `${APP_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MIMIC — 30초 만에 인터랙티브 매뉴얼",
    description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로. AI가 단계별 설명과 자막까지 자동 생성합니다.",
    images: [`${APP_URL}/api/og`],
  },
  icons: {
    icon: [
      { url: "/mimic-logo.png", type: "image/png" },
    ],
    apple: "/mimic-logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MIMIC",
  url: APP_URL,
  logo: `${APP_URL}/mimic-logo.png`,
  description: "웹과 앱 화면을 30초 만에 인터랙티브 매뉴얼로 만드는 AI 서비스",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: "Korean",
  },
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
