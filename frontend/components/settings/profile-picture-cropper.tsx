"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { createClient } from "@/lib/supabase/client"
import imageCompression from "browser-image-compression"
import { Minus, Plus } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface ProfilePictureCropperProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageFile: File | null
  userId: string
  onUploadComplete: (result: { path: string; url: string }) => void
}

const CROP_SIZE = 256
const MAX_ZOOM = 3

export function ProfilePictureCropper({
  open,
  onOpenChange,
  imageFile,
  userId,
  onUploadComplete,
}: ProfilePictureCropperProps) {
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  const dragStartRef = useRef({ x: 0, y: 0 })
  const positionStartRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const { naturalWidth, naturalHeight } = img
    setImageDimensions({ width: naturalWidth, height: naturalHeight })

    // Calculate minimum zoom so image covers the crop area (like object-fit: cover)
    const minZoomToFit = Math.max(CROP_SIZE / naturalWidth, CROP_SIZE / naturalHeight)
    setMinZoom(minZoomToFit)
    setZoom(minZoomToFit)
    setPosition({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile)
      setImageUrl(url)
      setZoom(1)
      setMinZoom(1)
      setPosition({ x: 0, y: 0 })
      return () => URL.revokeObjectURL(url)
    } else {
      setImageUrl(null)
    }
  }, [imageFile])

  const getConstrainedPosition = useCallback(
    (newX: number, newY: number) => {
      const scaledWidth = imageDimensions.width * zoom
      const scaledHeight = imageDimensions.height * zoom
      const maxX = Math.max(0, (scaledWidth - CROP_SIZE) / 2)
      const maxY = Math.max(0, (scaledHeight - CROP_SIZE) / 2)

      return {
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY)),
      }
    },
    [imageDimensions, zoom],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      positionStartRef.current = position
    },
    [position],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      const newPosition = getConstrainedPosition(
        positionStartRef.current.x + deltaX,
        positionStartRef.current.y + deltaY,
      )
      setPosition(newPosition)
    },
    [isDragging, getConstrainedPosition],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        setIsDragging(true)
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        positionStartRef.current = position
      }
    },
    [position],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return

      const deltaX = e.touches[0].clientX - dragStartRef.current.x
      const deltaY = e.touches[0].clientY - dragStartRef.current.y

      const newPosition = getConstrainedPosition(
        positionStartRef.current.x + deltaX,
        positionStartRef.current.y + deltaY,
      )
      setPosition(newPosition)
    },
    [isDragging, getConstrainedPosition],
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleZoomChange = useCallback(
    (value: number[]) => {
      const newZoom = value[0]
      setZoom(newZoom)
      const newPosition = getConstrainedPosition(position.x, position.y)
      setPosition(newPosition)
    },
    [getConstrainedPosition, position],
  )

  const cropAndUpload = useCallback(async () => {
    if (!imageFile || !imageUrl) return

    setIsUploading(true)

    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = imageUrl
      })

      const canvas = document.createElement("canvas")
      canvas.width = CROP_SIZE
      canvas.height = CROP_SIZE
      const ctx = canvas.getContext("2d")

      if (!ctx) throw new Error("Could not get canvas context")

      const scaledWidth = img.naturalWidth * zoom
      const scaledHeight = img.naturalHeight * zoom
      const sourceX = (scaledWidth / 2 - CROP_SIZE / 2 - position.x) / zoom
      const sourceY = (scaledHeight / 2 - CROP_SIZE / 2 - position.y) / zoom
      const sourceWidth = CROP_SIZE / zoom
      const sourceHeight = CROP_SIZE / zoom

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, CROP_SIZE, CROP_SIZE)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error("Failed to create blob"))
          },
          "image/webp",
          0.9,
        )
      })

      const fileToCompress = new File([blob], "profile.webp", { type: "image/webp" })
      const compressedFile = await imageCompression(fileToCompress, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: CROP_SIZE,
        useWebWorker: true,
        fileType: "image/webp",
      })

      const supabase = createClient()
      const fileName = `${Date.now()}.webp`
      const filePath = `${userId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, compressedFile, {
          contentType: "image/webp",
          upsert: true,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-pictures").getPublicUrl(filePath)

      onUploadComplete({
        path: filePath,
        url: publicUrl,
      })

      onOpenChange(false)
      setImageUrl(null)
      setMinZoom(1)
      setZoom(1)
      setPosition({ x: 0, y: 0 })
    } catch (error) {
      console.error("Upload failed:", error)
    } finally {
      setIsUploading(false)
    }
  }, [imageFile, imageUrl, zoom, position, userId, onUploadComplete, onOpenChange])

  const handleClose = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }
    setImageUrl(null)
    setMinZoom(1)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    onOpenChange(false)
  }, [imageUrl, onOpenChange])

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Adjust Profile Picture</AlertDialogTitle>
          <AlertDialogDescription>
            Drag to reposition and use the slider to zoom. The circular area shows how your profile
            picture will appear.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div
            ref={containerRef}
            className="relative mx-auto h-64 w-64 cursor-grab overflow-hidden rounded-full border-2 border-dashed active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Preview"
                className="pointer-events-none absolute select-none"
                style={{
                  width: imageDimensions.width * zoom,
                  height: imageDimensions.height * zoom,
                  left: `calc(50% + ${position.x}px)`,
                  top: `calc(50% + ${position.y}px)`,
                  transform: "translate(-50%, -50%)",
                  maxWidth: "none",
                }}
                onLoad={handleImageLoad}
                draggable={false}
              />
            )}
          </div>

          <div className="flex items-center gap-3 px-4">
            <Minus className="text-muted-foreground size-4 shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={handleZoomChange}
              min={minZoom}
              max={MAX_ZOOM}
              step={0.01}
              className="flex-1"
            />
            <Plus className="text-muted-foreground size-4 shrink-0" />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUploading}>Cancel</AlertDialogCancel>
          <Button onClick={cropAndUpload} isLoading={isUploading}>
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
