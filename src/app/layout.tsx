import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Plenty Valley Attendance", template: "%s · PV Attendance" },
  description: "Training attendance tracker for the Plenty Valley girls' team",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05603a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
