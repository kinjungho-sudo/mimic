import type { Metadata } from "next";
import localFont from "next/font/local";
import { BRAND_DESCRIPTION, BRAND_LOGO_IMAGE_PATH, BRAND_NAME, BRAND_TAGLINE, getBrandAppUrl } from "@/lib/brand";
import { ParroOnboardingProvider } from "@/components/onboarding/ParroOnboardingProvider";
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

const APP_URL = getBrandAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  openGraph: {
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    type: "website",
    url: APP_URL,
    siteName: BRAND_NAME,
    locale: "ko_KR",
    images: [
      {
        url: `${APP_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    images: [`${APP_URL}/api/og`],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'DErEe3J6cjpooLlNywJkFowNINqXHfiC-gZS6b90ZQY',
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_NAME,
  url: APP_URL,
  logo: `${APP_URL}${BRAND_LOGO_IMAGE_PATH}`,
  description: BRAND_DESCRIPTION,
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {/* Kakao SDK */}
        <script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
          integrity="sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
          crossOrigin="anonymous"
          async
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a className="parro-skip-link" href="#parro-main-content">
          본문으로 바로가기
        </a>
        <span id="parro-main-content" className="parro-main-target" tabIndex={-1} />
        <ParroOnboardingProvider>{children}</ParroOnboardingProvider>
      </body>
    </html>
  );
}
