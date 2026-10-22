import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

/** Felt & Clay — soft serif display + clean modern UI (not Inter). */
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poker Friends — mesa da galera",
  description:
    "Texas Hold'em com a galera da igreja — salas privadas, bots, chat e boa vibração.",
  applicationName: "Poker Friends",
  appleWebApp: {
    capable: true,
    title: "Poker Friends",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#163528",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
