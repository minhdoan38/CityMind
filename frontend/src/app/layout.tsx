import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CityMind AI",
  description: "AI-assisted decision intelligence for smarter communities",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${sourceSans.variable} h-full antialiased`}>
      <body className={`${sourceSans.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
