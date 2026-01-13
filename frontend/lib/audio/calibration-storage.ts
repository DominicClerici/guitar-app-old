"use client"

import type { GuitarCalibrationData } from "./calibration-types"

const STORAGE_PREFIX = "stringflow_calibration_"
const ACTIVE_CALIBRATION_KEY = "stringflow_active_calibration"

export function saveCalibrationData(data: GuitarCalibrationData): void {
  if (typeof window === "undefined") return

  const key = `${STORAGE_PREFIX}${data.id}`
  localStorage.setItem(key, JSON.stringify(data))
}

export function loadCalibrationData(id: string): GuitarCalibrationData | null {
  if (typeof window === "undefined") return null

  const key = `${STORAGE_PREFIX}${id}`
  const stored = localStorage.getItem(key)

  if (!stored) return null

  try {
    return JSON.parse(stored) as GuitarCalibrationData
  } catch {
    return null
  }
}

export function listCalibrations(): { id: string; name: string }[] {
  if (typeof window === "undefined") return []

  const calibrations: { id: string; name: string }[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          const data = JSON.parse(stored) as GuitarCalibrationData
          calibrations.push({ id: data.id, name: data.name })
        } catch {
          continue
        }
      }
    }
  }

  return calibrations
}

export function deleteCalibration(id: string): void {
  if (typeof window === "undefined") return

  const key = `${STORAGE_PREFIX}${id}`
  localStorage.removeItem(key)

  const activeId = localStorage.getItem(ACTIVE_CALIBRATION_KEY)
  if (activeId === id) {
    localStorage.removeItem(ACTIVE_CALIBRATION_KEY)
  }
}

export function getActiveCalibration(): GuitarCalibrationData | null {
  if (typeof window === "undefined") return null

  const activeId = localStorage.getItem(ACTIVE_CALIBRATION_KEY)
  if (!activeId) return null

  return loadCalibrationData(activeId)
}

export function setActiveCalibration(id: string): void {
  if (typeof window === "undefined") return

  const calibration = loadCalibrationData(id)
  if (calibration) {
    localStorage.setItem(ACTIVE_CALIBRATION_KEY, id)
  }
}

export function clearActiveCalibration(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(ACTIVE_CALIBRATION_KEY)
}
