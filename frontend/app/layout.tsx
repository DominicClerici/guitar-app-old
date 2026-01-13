import { TrpcProvider } from "@/context/trpc-provider"
import { AuthProvider } from "@/hooks/useAuth"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./animations.css"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Guitar App",
  description: "Learn guitar with ease",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TrpcProvider>
          <AuthProvider>{children}</AuthProvider>
        </TrpcProvider>
        <Toaster />
      </body>
    </html>
  )
}
