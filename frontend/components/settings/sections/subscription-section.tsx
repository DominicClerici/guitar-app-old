import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SubscriptionSection() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Subscription</CardTitle>
        <CardDescription>Manage your subscription and billing</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Subscription settings will be implemented here.
        </p>
      </CardContent>
    </Card>
  )
}
