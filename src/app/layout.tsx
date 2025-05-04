import type {Metadata} from 'next';
import {GeistSans} from 'geist/font/sans'; // Correct import for Geist Sans
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import Header from '@/components/layout/header'; // Import Header component

export const metadata: Metadata = {
  title: 'Sakura Studio', // Updated title
  description: 'Generate beautiful sakura-themed avatars.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
           {children}
        </main>
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}
