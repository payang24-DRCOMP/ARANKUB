import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "ARANKUB AI (เดโม)", template: "%s · ARANKUB AI" },
  description: "เดโมหน้าจอระบบ ARANKUB — ข้อมูลทั้งหมดเป็นข้อมูลจำลอง",
  // Google Translate แก้ DOM ใต้ React โดยตรงจน hydration พังทั้งหน้า
  // ระบบนี้เป็นภาษาไทยอยู่แล้ว จึงปิดการแปลอัตโนมัติ (คู่กับ lang="th")
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
