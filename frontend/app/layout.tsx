import { TrpcProvider } from "@/context/trpc-provider"
import { AuthProvider } from "@/hooks/useAuth"
import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import localFont from "next/font/local"
import { Toaster } from "sonner"
import "./animations.css"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const interDisplay = localFont({
  src: [
    { path: "../public/fonts/inter-display/InterDisplay-Thin.ttf", weight: "100", style: "normal" },
    {
      path: "../public/fonts/inter-display/InterDisplay-ThinItalic.ttf",
      weight: "100",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-ExtraLightItalic.ttf",
      weight: "200",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-LightItalic.ttf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-SemiBoldItalic.ttf",
      weight: "600",
      style: "italic",
    },
    { path: "../public/fonts/inter-display/InterDisplay-Bold.ttf", weight: "700", style: "normal" },
    {
      path: "../public/fonts/inter-display/InterDisplay-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-ExtraBoldItalic.ttf",
      weight: "800",
      style: "italic",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-Black.ttf",
      weight: "900",
      style: "normal",
    },
    {
      path: "../public/fonts/inter-display/InterDisplay-BlackItalic.ttf",
      weight: "900",
      style: "italic",
    },
  ],
  variable: "--font-inter-display",
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
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${interDisplay.variable} ${geistMono.variable} antialiased`}
      >
        <TrpcProvider>
          <AuthProvider>{children}</AuthProvider>
        </TrpcProvider>
        <Toaster />
      </body>
    </html>
  )
}
