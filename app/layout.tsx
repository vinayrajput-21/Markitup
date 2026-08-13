import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { TopProgress } from "@/components/ui/TopProgress";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarkUp — visual feedback for Apexure",
  description:
    "Upload files and collect pinned, contextual feedback from clients directly on the design.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=localStorage.getItem('ui-accent');var m=localStorage.getItem('ui-mode');var e=document.documentElement;if(a&&a!=='neutral')e.setAttribute('data-theme',a);if(m==='dark')e.classList.add('dark');}catch(_){}`,
          }}
        />
        <TopProgress />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
