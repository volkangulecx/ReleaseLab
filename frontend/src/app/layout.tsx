import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ReleaseLab — Studio-quality mastering",
    template: "%s | ReleaseLab",
  },
  description: "Upload, improve, release. Studio-quality mastering without a studio. Master your music in seconds with AI-powered presets.",
  keywords: ["mastering", "audio", "music", "production", "mixing", "LUFS", "loudness"],
  openGraph: {
    type: "website",
    title: "ReleaseLab — Master your music in seconds",
    description: "Studio-quality mastering without a studio. Upload your track, choose a preset, get release-ready audio.",
    siteName: "ReleaseLab",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReleaseLab — Master your music in seconds",
    description: "Studio-quality mastering without a studio.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: "#18181b", color: "#f4f4f5", border: "1px solid #27272a" },
          }}
        />
      </body>
    </html>
  );
}
