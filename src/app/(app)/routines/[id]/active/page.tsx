import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getActiveRoutineSessionForUser } from '@/server/db/routine-sessions';
import { ActiveRoutineView } from '@/components/ActiveRoutineView';

export default async function ActiveRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const { id } = await params;
  const session = await getActiveRoutineSessionForUser(userId);
  if (!session || session.routineId !== Number(id)) redirect(`/routines/${id}`);
  return <ActiveRoutineView />;
}
