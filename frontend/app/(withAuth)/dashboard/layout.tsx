import { TooltipProvider } from "@/components/ui/tooltip"

export default function layout({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}
