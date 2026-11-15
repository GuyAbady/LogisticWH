import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LogisticWH", template: "%s | LogisticWH" },
  description: 'ניהול מלאי, מצאי והחתמות ציוד דיגיטליות במרלו"ג',
  applicationName: "LogisticWH",
  appleWebApp: { capable: true, title: "LogisticWH", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
