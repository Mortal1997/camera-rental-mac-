import { getFinancialReport } from '../../actions/finance-actions';
import FinanceDashboard from '../components/FinanceDashboard';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const initialReport = await getFinancialReport();

  return <FinanceDashboard initialReport={initialReport} />;
}
