import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const notoSansDevanagari = localFont({
  src: "../node_modules/@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2",
  variable: "--font-noto-devanagari",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "DeedDraft",
    template: "%s | DeedDraft",
  },
  description: "Professional deed drafting workspace for Indian advocates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={[inter.variable, notoSansDevanagari.variable, "h-full", "antialiased"].join(" ")}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster closeButton position="top-right" richColors />
      </body>
    </html>
  );
}
