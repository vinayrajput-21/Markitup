import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
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
    "Upload mockups and collect pinned, contextual feedback from clients directly on the design.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=localStorage.getItem('ui-accent');var m=localStorage.getItem('ui-mode');var e=document.documentElement;if(a&&a!=='neutral')e.setAttribute('data-theme',a);if(m==='dark')e.classList.add('dark');}catch(_){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
