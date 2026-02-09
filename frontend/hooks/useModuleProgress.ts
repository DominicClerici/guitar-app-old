"use client"

import { trpc } from "@/lib/trpc/react"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

type LessonId = "cagedRoots" | "chordTones" | "cagedPentatonic" | "majorScale"

export function useModuleProgress(path: "caged", lesson: LessonId) {
  const progressQuery = trpc.learning.getLessonProgress.useQuery({
    path,
    lesson,
  })

  const mutation = trpc.learning.completeModule.useMutation({
    onError: () => {
      toast.error("Failed to save progress")
    },
    onSuccess: () => {
      progressQuery.refetch()
    },
  })

  const completedModuleIds = useMemo(
    () => new Set(progressQuery.data?.map((c) => c.moduleId) ?? []),
    [progressQuery.data],
  )

  const completeModule = useCallback(
    (moduleId: string) => {
      if (completedModuleIds.has(moduleId)) return
      mutation.mutate({ path, lesson, moduleId })
    },
    [path, lesson, mutation, completedModuleIds],
  )

  return {
    completedModuleIds,
    isLoading: progressQuery.isLoading,
    completeModule,
  }
}
