import { getSalesOrderById } from '@/modules/admin/actions/order-actions';
import { AdminOrderDetail } from './detail-view';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
    const { id } = await params;
    const order = await getSalesOrderById(id);

    return <AdminOrderDetail order={order} />;
}
