"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import useAuth from "@/hooks/useAuth"
import { trpc } from "@/lib/trpc/react"
import { changeEmailZod } from "@guitar/schemas"
import { CheckCircle, Lock, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type AuthProvider = "email" | "google" | "apple" | "github"

export default function AccountSection() {
  const { user, supabase } = useAuth()
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [authProvider, setAuthProvider] = useState<AuthProvider>("email")

  useEffect(() => {
    const detectAuthProvider = async () => {
      const { data } = await supabase.auth.getUser()
      const provider = data.user?.app_metadata?.provider
      if (provider === "google" || provider === "apple" || provider === "github") {
        setAuthProvider(provider)
      } else {
        setAuthProvider("email")
      }
    }
    detectAuthProvider()
  }, [supabase])

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChangeSent, setEmailChangeSent] = useState(false)

  const requestPasswordReset = trpc.user.requestPasswordReset.useMutation({
    onSuccess: () => {
      setResetEmailSent(true)
      toast.success("Password reset email sent! Check your inbox.")
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send password reset email")
    },
  })

  const requestEmailChange = trpc.user.requestEmailChange.useMutation({
    onSuccess: () => {
      setEmailChangeSent(true)
      setIsEmailDialogOpen(false)
      setNewEmail("")
      toast.success("Email change confirmation sent! Check both email inboxes.")
    },
    onError: (error) => {
      if (error.message.includes("already in use")) {
        toast.error("This email is already in use by another account")
      } else {
        toast.error(error.message || "Failed to request email change")
      }
    },
  })

  const handleRequestPasswordReset = () => {
    if (!user?.email) {
      toast.error("No email associated with this account")
      return
    }

    requestPasswordReset.mutate({
      redirectUrl: `${window.location.origin}/auth/callback?type=recovery`,
    })
  }

  const handleRequestEmailChange = () => {
    setEmailError(null)

    const result = changeEmailZod.safeParse({ email: newEmail })
    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message ?? "Invalid email"
      setEmailError(errorMessage)
      return
    }

    if (newEmail.toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError("New email must be different from your current email")
      return
    }

    requestEmailChange.mutate({
      newEmail,
      redirectUrl: `${window.location.origin}/auth/callback?type=email_change`,
    })
  }

  const isEmailAuth = authProvider === "email"
  const providerDisplayName =
    authProvider === "google"
      ? "Google"
      : authProvider === "apple"
        ? "Apple"
        : authProvider === "github"
          ? "GitHub"
          : "OAuth"

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Account Settings</CardTitle>
        <CardDescription>Manage your account security and credentials</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          {/* Email Section */}
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Mail className="text-primary size-5" />
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Email Address</span>
                <span className="text-muted-foreground text-sm">{user?.email ?? "Loading..."}</span>
              </div>

              {emailChangeSent ? (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-lg border px-4 py-3">
                  <CheckCircle className="text-primary size-4 shrink-0" />
                  <p className="text-sm">
                    Email change confirmation sent. Please check both your current and new email
                    inboxes.
                  </p>
                </div>
              ) : isEmailAuth ? (
                <Button
                  variant="outline"
                  onClick={() => setIsEmailDialogOpen(true)}
                  className="w-fit"
                >
                  Change Email
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Email is managed by your {providerDisplayName} account
                </p>
              )}
            </div>
          </div>

          {/* Email Change Dialog */}
          <Dialog
            open={isEmailDialogOpen}
            onOpenChange={(open) => {
              setIsEmailDialogOpen(open)
              if (!open) {
                setNewEmail("")
                setEmailError(null)
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Email Address</DialogTitle>
                <DialogDescription>
                  Enter your new email address. We&apos;ll send confirmation links to both your
                  current and new email addresses.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <label htmlFor="new-email" className="mb-2 block text-sm font-medium">
                  New Email Address
                </label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter your new email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value)
                    setEmailError(null)
                  }}
                  disabled={requestEmailChange.isPending}
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && <p className="text-destructive mt-1.5 text-sm">{emailError}</p>}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEmailDialogOpen(false)}
                  disabled={requestEmailChange.isPending}
                >
                  Cancel
                </Button>
                <Button onClick={handleRequestEmailChange} isLoading={requestEmailChange.isPending}>
                  Send Confirmation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Separator />

          {/* Password Section */}
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Lock className="text-primary size-5" />
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Password</span>
                <span className="text-muted-foreground font-mono text-sm tracking-wider">
                  ••••••••••
                </span>
              </div>

              {resetEmailSent ? (
                <div className="bg-primary/5 border-primary/20 flex items-center gap-2 rounded-lg border px-4 py-3">
                  <CheckCircle className="text-primary size-4 shrink-0" />
                  <p className="text-sm">
                    Password reset email sent to <span className="font-medium">{user?.email}</span>.
                    Please check your inbox.
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleRequestPasswordReset}
                  isLoading={requestPasswordReset.isPending}
                  className="w-fit"
                >
                  Request Password Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
