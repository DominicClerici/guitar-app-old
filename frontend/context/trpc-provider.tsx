"use client"

import { TRPCProvider } from "@/lib/trpc"

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>
}
