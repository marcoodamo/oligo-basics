import { getSalesOrderById } from '@/modules/admin/actions/order-actions';
import { AdminOrderDetail } from './detail-view';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
    const { id } = await params;
    try {
        const order = await getSalesOrderById(id);
        return <AdminOrderDetail order={order} />;
    } catch {
        notFound();
    }
}
