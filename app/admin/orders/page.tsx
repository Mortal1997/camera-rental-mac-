import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function OrdersPage() {
  redirect('/admin/orders/dispatch');
}
