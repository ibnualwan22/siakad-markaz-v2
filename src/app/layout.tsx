import type { Metadata } from "next";
import "./globals.css";
import { FetchInterceptor } from "@/components/FetchInterceptor";


export const metadata: Metadata = {
  title: "Sistem Manajemen Nilai & Ijazah",
  description: "Aplikasi manajemen nilai santri, cetak ijazah online, dan syahadah offline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        {/* Siakad selalu mode terang: jangan ikuti mode gelap sistem/perangkat */}
        <meta name="color-scheme" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <FetchInterceptor />
        {children}
      </body>
    </html>
  );
}
