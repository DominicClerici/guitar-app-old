"use client"

import { useEffect, useState } from "react"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Button } from "@/components/ui/button"
import { useModuleProgress } from "@/hooks/useModuleProgress"
import { getFlowConfig } from "@/lib/caged-practice/flow-configs"
import { getLessonConfig } from "@/lib/caged-practice/module-config"
import {
  CAGED_SHAPE_NAMES,
  generateFretboardNotes,
  getCAGEDShapeNotes,
  getNoteName,
  getNotesByDegrees,
  getRootNotes,
  NOTE_NAMES,
  SCALE_FORMULAS,
} from "@/lib/theory"
import { BookOpen, Play } from "lucide-react"

import CAGEDArticle from "./articles/caged-article"
import ChordTonesArticle from "./articles/chord-tones-article"
import MajorScaleArticle from "./articles/major-scale-article"
import MinorPentatonicArticle from "./articles/minor-pentatonic-article"
import CAGEDPracticeClient from "./caged-practice-client"
import LearnHeader from "./learn-header"
import LearnPreview from "./learn-preview"
import LessonSidebar from "./lesson-sidebar"
import PracticeInfo from "./practice-info"

type ViewMode = "article" | "preview" | "practice"
type PreviewShape = "full" | "C" | "A" | "G" | "E" | "D"

const MODULE_CONFIG: Record<
  string,
  {
    title: string
    subtitle: string
    gradient: string
    ArticleComponent: React.ComponentType<{ onEnterPreview: () => void }>
  }
> = {
  cagedRoots: {
    title: "CAGED Roots",
    subtitle: "Foundation patterns",
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
    ArticleComponent: CAGEDArticle,
  },
  chordTones: {
    title: "Chord Tones",
    subtitle: "Harmonic navigation",
    gradient: "from-violet-500 via-purple-600 to-indigo-700",
    ArticleComponent: ChordTonesArticle,
  },
  cagedPentatonic: {
    title: "Minor Pentatonic",
    subtitle: "Solo essentials",
    gradient: "from-rose-500 via-pink-600 to-fuchsia-700",
    ArticleComponent: MinorPentatonicArticle,
  },
  majorScale: {
    title: "Major Scale",
    subtitle: "Complete scale mastery",
    gradient: "from-amber-500 via-orange-600 to-red-700",
    ArticleComponent: MajorScaleArticle,
  },
}

interface LearnModuleClientProps {
  module: string
}

export default function LearnModuleClient({ module }: LearnModuleClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("article")
  const [previewShape, setPreviewShape] = useState<PreviewShape>("full")
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(2) // Default to D
  const [showDegree, setShowDegree] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState<string>("intro-article")
  const [startingStepIndex, setStartingStepIndex] = useState(0)

  const lessonConfig = getLessonConfig(module)
  const {
    completedModuleIds,
    isLoading: progressLoading,
    completeModule,
  } = useModuleProgress(
    "caged",
    module as "cagedRoots" | "chordTones" | "cagedPentatonic" | "majorScale",
  )

  const currentModuleId =
    lessonConfig?.modules.find((m) => !completedModuleIds.has(m.id))?.id ?? null

  useEffect(() => {
    const stored = sessionStorage.getItem("practiceConfig")
    if (stored) {
      try {
        const config = JSON.parse(stored)
        if (config.key && config.key !== "random") {
          const keyIndex = NOTE_NAMES.indexOf(config.key)
          if (keyIndex >= 0) {
            setSelectedKeyIndex(keyIndex)
          }
        }
      } catch {
        // Invalid config, use default key
      }
    }
  }, [])

  const config = MODULE_CONFIG[module]

  if (!config) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="from-muted/50 to-muted flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br">
          <BookOpen className="text-muted-foreground size-10" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">Module Not Found</h2>
          <p className="text-muted-foreground">
            The learning module &ldquo;{module}&rdquo; doesn&apos;t exist yet.
          </p>
        </div>
      </div>
    )
  }

  const { title, subtitle, gradient, ArticleComponent } = config

  const practiceType =
    module === "cagedPentatonic"
      ? ("pentatonic" as const)
      : module === "chordTones"
        ? ("chordTones" as const)
        : module === "majorScale"
          ? ("majorScale" as const)
          : ("roots" as const)

  const formula = SCALE_FORMULAS.major
  const fullScale = generateFretboardNotes(selectedKeyIndex, formula)
  const filteredNotes =
    practiceType === "majorScale"
      ? fullScale
      : practiceType === "pentatonic"
        ? getNotesByDegrees(fullScale, [1, 2, 3, 5, 6])
        : practiceType === "chordTones"
          ? getNotesByDegrees(fullScale, [1, 3, 5])
          : getRootNotes(fullScale)

  const displayNotes =
    previewShape === "full"
      ? filteredNotes
      : getCAGEDShapeNotes(previewShape, filteredNotes, selectedKeyIndex, undefined, formula)

  const markers: Marker[] = displayNotes.map((note) => ({
    stringIndex: note.stringIndex,
    fretIndex: note.fretIndex,
    type: note.degree === 1 ? "root" : "chord-tone",
    label: getNoteName(note.noteIndex),
    degree: note.degree,
  }))

  const handleEnterPreview = () => {
    completeModule("intro-article")
    setViewMode("preview")
  }

  const handleBackToArticle = () => {
    setViewMode("article")
  }

  const handleSelectModule = (moduleId: string) => {
    setActiveModuleId(moduleId)

    if (moduleId === "intro-article") {
      setViewMode("article")
      return
    }

    const flowCfg = getFlowConfig(practiceType)
    const stepIndex = flowCfg.steps.findIndex((s) => s.id === moduleId)

    if (stepIndex >= 0) {
      setStartingStepIndex(stepIndex)
      setViewMode("practice")
    }
  }

  return (
    <div className="flex justify-center gap-6">
      {lessonConfig && (
        <LessonSidebar
          lessonConfig={lessonConfig}
          completedModuleIds={completedModuleIds}
          currentModuleId={currentModuleId}
          activeModuleId={activeModuleId}
          onSelectModule={handleSelectModule}
          isLoading={progressLoading}
        />
      )}
      <div className="w-full max-w-7xl min-w-0 shrink grow">
        <div className="flex flex-col gap-6">
          <LearnHeader
            title={title}
            subtitle={subtitle}
            gradient={gradient}
            keyName={NOTE_NAMES[selectedKeyIndex]}
            viewMode={viewMode}
            onToggleView={() => setViewMode(viewMode === "article" ? "preview" : "article")}
          />

          {viewMode === "article" ? (
            <div className="animate-fade-in">
              <ArticleComponent onEnterPreview={handleEnterPreview} />
            </div>
          ) : viewMode === "preview" ? (
            <div className="animate-fade-in flex flex-col gap-6">
              <LearnPreview
                previewShape={previewShape}
                onShapeChange={(shape) => setPreviewShape(shape as PreviewShape)}
                showDegree={showDegree}
                onShowDegreeChange={setShowDegree}
                availableShapes={CAGED_SHAPE_NAMES}
              />

              <div className="transition-opacity duration-300">
                <Fretboard markers={markers} showDegree={showDegree} className="w-full" />
              </div>

              <PracticeInfo
                practiceType={practiceType}
                keyIndex={selectedKeyIndex}
                handleEnterPractice={() => setViewMode("practice")}
                handleBackToArticle={handleBackToArticle}
              />

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="xl" onClick={handleBackToArticle}>
                    <BookOpen className="size-4" />
                    Back to Article
                  </Button>
                  <Button size="xl" onClick={() => setViewMode("practice")}>
                    <Play className="size-4 fill-current" />
                    Start Practice
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <CAGEDPracticeClient
                key={`practice-${startingStepIndex}`}
                initialKeyIndex={selectedKeyIndex}
                practiceType={practiceType}
                flowConfig={getFlowConfig(practiceType)}
                autoStart
                onExit={() => setViewMode("preview")}
                onComplete={() => setViewMode("preview")}
                initialStepIndex={startingStepIndex}
                onModuleComplete={completeModule}
              />
            </div>
          )}
        </div>
      </div>
      <div className="hidden max-w-82 min-w-0 shrink grow 2xl:block" />
    </div>
  )
}
