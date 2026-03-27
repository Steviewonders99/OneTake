import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneForma Recruitment Intake",
  description: "AI-powered recruitment marketing intake system for OneForma by Centific",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
                borderRadius: "var(--radius-md)",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
