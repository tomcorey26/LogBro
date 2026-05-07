'use client';

import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';
import { ReplayToursButton } from '@/components/ReplayToursButton';

export default function AccountPage() {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Account" />
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" type="text" value={user?.username ?? ''} readOnly />
      </div>
      <div className="space-y-2 pt-4 border-t">
        <Label>Onboarding</Label>
        <p className="text-sm text-muted-foreground">
          Replay the first-visit tours that walk through the app.
        </p>
        <ReplayToursButton />
      </div>
    </PageContainer>
  );
}
