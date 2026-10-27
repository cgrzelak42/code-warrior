import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { Nav } from "@/components/Nav";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["600", "700", "800"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Blackjack IQ",
  description: "A premium blackjack table and basic-strategy coach. Virtual chips only.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${manrope.variable}`}>
      <body>
        <AppProvider>
          <Nav />
          <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 md:pb-10">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
