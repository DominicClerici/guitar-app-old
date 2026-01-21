import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api } from "@/lib/trpc/server"
import Link from "next/link"
import LogoutButton from "../logout-button"
import TestPage from "../testpage"
import LandingHero from "@/components/landing/landing-hero"

export default async function Home() {
  const caller = await api()
  const user = await caller.user.getUserInfo()
  return (
      <LandingHero />
    // <div className="flex h-screen flex-col items-center justify-center">
    //   <div className="flex flex-wrap gap-4">
    //     <Card className="grow">
    //       <p>Username: {user?.name || "No name/not logged in"}</p>
    //       {user ? <LogoutButton /> : <Link href="/login">Login</Link>}
    //     </Card>
    //     <div className="flex flex-col gap-4">
    //       {user && (
    //         <Link className={buttonVariants({ variant: "default", size: "lg" })} href="/dashboard">
    //           Dashboard
    //         </Link>
    //       )}
    //       <Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/tuner">
    //         Tuner
    //       </Link>
    //       <Link
    //         className={buttonVariants({ variant: "outline", size: "lg" })}
    //         href="/scale-trainer"
    //       >
    //         Scale trainer
    //       </Link>
    //     </div>
    //   </div>
    //   <TestPage />
    // </div>
  )
}
