import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_KR({
  variable: "--font-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const serif = Noto_Serif_KR({
  variable: "--font-serif-kr",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "경기 초등 전보맵",
  description:
    "경기도 공립 초등학교 급지와 거주지 기준 자동차·대중교통 이동시간을 비교합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-[#f7f4ef] font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
