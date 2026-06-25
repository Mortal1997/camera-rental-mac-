import { getAdminData } from '../../../actions/admin-actions';
import MiniGanttChart from '../../components/MiniGanttChart';

export const dynamic = 'force-dynamic';

export default async function DispatchGanttSection() {
  const { equipment } = await getAdminData();

  return <MiniGanttChart equipment={equipment} />;
}
