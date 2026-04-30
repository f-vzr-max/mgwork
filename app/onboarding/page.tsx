import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome to MG Work</CardTitle>
          <CardDescription>Tell us who you are so we can route you to the right experience.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Role selection lands here in Phase 2. For now, an admin needs to set your role in the Clerk dashboard
          (publicMetadata.role) — values: CANDIDATE, ENTERPRISE, STAFF_FOLLOWUP, STAFF_DOCUMENTS, ADMIN, SUPER_ADMIN.
        </CardContent>
      </Card>
    </div>
  );
}
