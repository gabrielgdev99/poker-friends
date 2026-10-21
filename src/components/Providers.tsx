"use client";

import { SessionProvider } from "next-auth/react";
import { PlayerProvider } from "@/components/PlayerProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PlayerProvider>{children}</PlayerProvider>
    </SessionProvider>
  );
}
