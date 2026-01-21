import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function NotificationsSection() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Notifications</CardTitle>
        <CardDescription>Configure how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Notification settings will be implemented here.
        </p>
      </CardContent>
    </Card>
  )
}
