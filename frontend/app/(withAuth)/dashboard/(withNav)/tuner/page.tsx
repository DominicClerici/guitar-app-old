import TunerDashboard from "@/components/tuner/tuner-dashboard"

export default function TunerPage() {
  return (
    <div className="w-full space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Tuner</h1>
        <p className="text-muted-foreground">
          Tune your guitar with precision using our real-time pitch detection.
        </p>
      </div>

      <TunerDashboard />
    </div>
  )
}
