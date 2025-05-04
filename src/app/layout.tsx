import type {Metadata} from 'next';
import {GeistSans} from 'geist/font/sans'; // Correct import for Geist Sans
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import Header from '@/components/layout/header'; // Import Header component

export const metadata: Metadata = {
  title: '櫻花工作室', // Updated title in Cantonese
  description: '創造靚靚櫻花主題頭像啦！', // Updated description in Cantonese
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">{/* Set language to Hong Kong Cantonese */}
      <body className={`${GeistSans.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-6"> {/* Reduced py padding */}
           {children}
        </main>
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}
