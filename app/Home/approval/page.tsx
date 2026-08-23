import { redirect } from 'next/navigation';
import ApprovalManager from './ApprovalManager';
import { getApprovalDashboardData, type ApprovalDashboardData } from './actions';

export const dynamic = 'force-dynamic';

export default async function ApprovalPage() {
  let initialData: ApprovalDashboardData;
  try {
    initialData = await getApprovalDashboardData();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('登录状态')) redirect('/login');
    if (message.includes('权限')) redirect('/forbidden');
    throw error;
  }
  return <ApprovalManager initialData={initialData} />;
}
