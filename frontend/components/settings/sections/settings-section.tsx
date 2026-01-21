import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsSection() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Settings</CardTitle>
        <CardDescription>Customize your app preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">App settings will be implemented here.</p>
      </CardContent>
    </Card>
  )
}
