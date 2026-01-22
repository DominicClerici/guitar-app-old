"use client"

import PracticeDialog from "@/components/practice/practice-dialog"
import { useState } from "react"

type PracticeItem = {
  title: string
  subtitle: string
  href: string
  gradient: string
  pattern: string
  formulaType: "scale" | "arpeggio" | "caged"
  formulaId: string
  hideShapes?: boolean
}

const scales: PracticeItem[] = [
  {
    title: "Major Scale",
    subtitle: "The foundation",
    href: "/dashboard/practice/scales",
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    pattern: "major",
    formulaType: "scale",
    formulaId: "major",
  },
  {
    title: "Minor Scale",
    subtitle: "Emotional depth",
    href: "/dashboard/practice/scales",
    gradient: "from-rose-600 via-pink-600 to-red-700",
    pattern: "minor",
    formulaType: "scale",
    formulaId: "naturalMinor",
  },
  {
    title: "Major Pentatonic",
    subtitle: "Blues & rock essential",
    href: "/dashboard/practice/scales",
    gradient: "from-amber-500 via-orange-500 to-yellow-600",
    pattern: "pentatonic-major",
    formulaType: "scale",
    formulaId: "majorPentatonic",
  },
  {
    title: "Minor Pentatonic",
    subtitle: "Solo building blocks",
    href: "/dashboard/practice/scales",
    gradient: "from-cyan-500 via-teal-500 to-emerald-600",
    pattern: "pentatonic-minor",
    formulaType: "scale",
    formulaId: "minorPentatonic",
  },
]

const arpeggios: PracticeItem[] = [
  {
    title: "Major Arpeggio",
    subtitle: "Bright & uplifting",
    href: "/dashboard/practice/scales",
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
    pattern: "arp-major",
    formulaType: "arpeggio",
    formulaId: "major",
  },
  {
    title: "Minor Arpeggio",
    subtitle: "Dark & moody",
    href: "/dashboard/practice/scales",
    gradient: "from-fuchsia-600 via-purple-600 to-violet-700",
    pattern: "arp-minor",
    formulaType: "arpeggio",
    formulaId: "minor",
  },
  {
    title: "Dominant 7th",
    subtitle: "Bluesy tension",
    href: "/dashboard/practice/scales",
    gradient: "from-lime-500 via-green-500 to-emerald-600",
    pattern: "arp-dom7",
    formulaType: "arpeggio",
    formulaId: "dom7",
  },
  {
    title: "Minor 7th",
    subtitle: "Jazz smoothness",
    href: "/dashboard/practice/scales",
    gradient: "from-orange-500 via-red-500 to-rose-600",
    pattern: "arp-min7",
    formulaType: "arpeggio",
    formulaId: "min7",
  },
]

function WavePattern({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path
        d="M0 50 Q25 20 50 50 T100 50 T150 50 T200 50 V100 H0 Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M0 60 Q25 30 50 60 T100 60 T150 60 T200 60 V100 H0 Z"
        fill="currentColor"
        opacity="0.1"
      />
    </svg>
  )
}

function DiagonalLines({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id="diagonals" patternUnits="userSpaceOnUse" width="10" height="10">
          <path
            d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.2"
          />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#diagonals)" />
    </svg>
  )
}

function CirclePattern({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id="circles" patternUnits="userSpaceOnUse" width="20" height="20">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.15"
          />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#circles)" />
    </svg>
  )
}

function DotGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <pattern id="dots" patternUnits="userSpaceOnUse" width="10" height="10">
          <circle cx="5" cy="5" r="1" fill="currentColor" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#dots)" />
    </svg>
  )
}

function GuitarStrings({ className }: { className?: string }) {
  return (
    <div className={className}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute right-0 left-0 h-px bg-white/20"
          style={{ top: `${20 + i * 12}%` }}
        />
      ))}
    </div>
  )
}

function PracticeTile({
  title,
  subtitle,
  gradient,
  pattern,
  index,
  onClick,
}: {
  title: string
  subtitle: string
  gradient: string
  pattern: string
  index: number
  onClick: () => void
}) {
  const getPattern = () => {
    switch (pattern) {
      case "major":
      case "arp-major":
        return <WavePattern className="absolute inset-0 h-full w-full text-white" />
      case "minor":
      case "arp-minor":
        return <DiagonalLines className="absolute inset-0 h-full w-full text-white" />
      case "pentatonic-major":
      case "arp-dom7":
      case "chord-tones":
        return <CirclePattern className="absolute inset-0 h-full w-full text-white" />
      case "pentatonic-minor":
      case "arp-min7":
      case "caged-pentatonic":
        return <DotGrid className="absolute inset-0 h-full w-full text-white" />
      case "caged-roots":
        return <GuitarStrings className="absolute inset-0 h-full w-full" />
      default:
        return <GuitarStrings className="absolute inset-0 h-full w-full" />
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-36 min-w-[220px] cursor-pointer flex-col justify-end overflow-hidden rounded-xl p-4 text-left transition-all duration-300 hover:shadow-2xl sm:h-40 sm:min-w-[260px] md:h-44 md:min-w-[300px]"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} transition-all duration-500 group-hover:scale-110`}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {getPattern()}

      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:bg-white/20" />

      <div className="absolute right-0 bottom-0 left-0 h-1 origin-left scale-x-0 bg-white/50 transition-transform duration-300 group-hover:scale-x-100" />

      <div className="relative z-10">
        <p className="mb-1 text-xs font-medium tracking-wider text-white/70 uppercase">
          {subtitle}
        </p>
        <h3 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          {title}
        </h3>
      </div>
    </button>
  )
}

function PracticeRow({
  title,
  items,
  sectionIndex,
  onSelectItem,
}: {
  title: string
  items: PracticeItem[]
  sectionIndex: number
  onSelectItem: (item: PracticeItem) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        <div className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
      </div>

      <div className="relative -mx-6 px-6">
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
          {items.map((item, index) => (
            <PracticeTile
              key={item.title}
              title={item.title}
              subtitle={item.subtitle}
              gradient={item.gradient}
              pattern={item.pattern}
              index={sectionIndex * items.length + index}
              onClick={() => onSelectItem(item)}
            />
          ))}
        </div>

        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l to-transparent" />
      </div>
    </div>
  )
}

export default function PracticePage() {
  const [selectedItem, setSelectedItem] = useState<PracticeItem | null>(null)

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Practice</h1>
        <p className="text-muted-foreground">
          Choose a scale or arpeggio to practice. StringFlow will listen and give you feedback.
        </p>
      </div>

      <PracticeRow title="Scales" items={scales} sectionIndex={1} onSelectItem={setSelectedItem} />
      <PracticeRow
        title="Arpeggios"
        items={arpeggios}
        sectionIndex={2}
        onSelectItem={setSelectedItem}
      />

      <PracticeDialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        title={selectedItem?.title ?? ""}
        subtitle={selectedItem?.subtitle ?? ""}
        href={selectedItem?.href ?? ""}
        gradient={selectedItem?.gradient ?? ""}
        formulaType={selectedItem?.formulaType ?? "scale"}
        formulaId={selectedItem?.formulaId ?? "major"}
        hideShapes={selectedItem?.hideShapes}
      />
    </div>
  )
}
