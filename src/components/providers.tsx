"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "./toast";
import { SocketProvider } from "./socket-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <SocketProvider>{children}</SocketProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
