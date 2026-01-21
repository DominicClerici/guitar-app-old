"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc"
import { useForm } from "@tanstack/react-form"
import { Camera, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { COUNTRIES } from "../countries"
import { ProfilePictureCropper } from "../profile-picture-cropper"

const profileFormSchema = z.object({
  name: z.string().max(100, "Name must be 100 characters or less"),
  bio: z.string().max(1000, "Bio must be 1000 characters or less"),
  country: z.string(),
})

export default function ProfileSection() {
  const utils = trpc.useUtils()
  const { data: user, isLoading } = trpc.user.getUserInfo.useQuery()
  const { mutate: updateProfile, isPending } = trpc.user.updateUserProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated")
      utils.user.getUserInfo.invalidate()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const [cropperOpen, setCropperOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/bmp"]
      if (!allowedTypes.includes(file.type)) {
        toast.error("Please select a JPEG, PNG, WebP, or BMP image")
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be less than 10MB")
        return
      }

      const dimensions = await getImageDimensions(file)
      if (dimensions.width < 300 || dimensions.height < 300) {
        toast.error("Image must be at least 300x300 pixels")
        return
      }

      setSelectedFile(file)
      setCropperOpen(true)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => {
        resolve({ width: 0, height: 0 })
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  const handleUploadComplete = (result: { path: string; url: string }) => {
    updateProfile({ profilePicture: result })
  }

  const form = useForm({
    defaultValues: {
      name: "",
      bio: "",
      country: "",
    },
    validators: {
      onSubmit: profileFormSchema,
    },
    onSubmit: ({ value }) => {
      updateProfile({
        name: value.name || undefined,
        bio: value.bio || undefined,
        country: value.country || undefined,
      })
    },
  })

  useEffect(() => {
    if (user) {
      form.setFieldValue("name", user.name ?? "")
      form.setFieldValue("bio", user.profile?.bio ?? "")
      form.setFieldValue("country", user.profile?.country ?? "")
    }
  }, [user])

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="flex flex-col gap-6 pt-4">
            {/* Profile Image */}
            <div className="mr-auto mb-4 flex flex-col items-center gap-2 pl-4">
              <div className="group/container relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-muted group hover:border-primary/50 relative flex size-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors hover:border-solid"
                >
                  {user?.profile?.profilePicture?.url ? (
                    <>
                      <img
                        src={user.profile.profilePicture.url}
                        alt="Profile"
                        className="size-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="size-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera className="text-muted-foreground group-hover:text-primary size-8 transition-colors" />
                  )}
                </button>
                {user?.profile?.profilePicture?.url && (
                  <button
                    type="button"
                    onClick={() => updateProfile({ profilePicture: null })}
                    disabled={isPending}
                    className="bg-destructive-background text-destructive hover:text-destructive-foreground border-destructive-border absolute top-1 right-1 flex size-7 cursor-pointer items-center justify-center rounded-full border opacity-0 transition-all duration-150 group-hover/container:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <ProfilePictureCropper
              open={cropperOpen}
              onOpenChange={setCropperOpen}
              imageFile={selectedFile}
              userId={user?.id ?? ""}
              onUploadComplete={handleUploadComplete}
            />

            {/* Form Fields */}
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field
                  name="name"
                  children={(field) => {
                    const errors = field.state.meta.errors
                    const isInvalid = errors.length > 0 && field.state.meta.isTouched
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Display Name</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          placeholder="Your display name"
                          maxLength={100}
                        />
                        <FieldDescription>
                          This is how other musicians will see you on StringFlow.
                        </FieldDescription>
                        {isInvalid && <FieldError errors={errors} />}
                      </Field>
                    )
                  }}
                />

                <form.Field
                  name="country"
                  children={(field) => {
                    const errors = field.state.meta.errors
                    const isInvalid = errors.length > 0 && field.state.meta.isTouched
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Country</FieldLabel>
                        <Select value={field.state.value} onValueChange={field.handleChange}>
                          <SelectTrigger id={field.name} className="w-full">
                            <SelectValue placeholder="Select your country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldDescription>
                          Help us connect you with local musicians and events.
                        </FieldDescription>
                        {isInvalid && <FieldError errors={errors} />}
                      </Field>
                    )
                  }}
                />
              </div>

              <form.Field
                name="bio"
                children={(field) => {
                  const errors = field.state.meta.errors
                  const isInvalid = errors.length > 0 && field.state.meta.isTouched
                  const charCount = field.state.value.length
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Bio</FieldLabel>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="Tell us about your musical journey..."
                        className="min-h-24 resize-none"
                        maxLength={1000}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <FieldDescription>
                          Share your experience, favorite genres, or what you&apos;re learning.
                        </FieldDescription>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {charCount}/1000
                        </span>
                      </div>
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  )
                }}
              />

              <div className="pt-2">
                <Button type="submit" isLoading={isPending}>
                  Save Changes
                </Button>
              </div>
            </FieldGroup>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
