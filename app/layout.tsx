import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ConditionalSidebar } from "@/components/conditional-sidebar";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Surf Wala - Booking System",
  description: "Admin dashboard for Surf Wala surf school and accommodation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <ConditionalSidebar />
          <main className="flex-1 overflow-auto bg-muted/30 p-3 md:p-6">
            {children}
          </main>
        </div>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
