import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HydrationLensInit } from "./hydration-lens-init";

export const metadata: Metadata = {
  title: "hydration-lens — Next.js demo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <HydrationLensInit />
        {children}
      </body>
    </html>
  );
}
