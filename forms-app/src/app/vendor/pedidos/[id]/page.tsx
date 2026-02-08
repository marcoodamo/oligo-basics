import { getSalesOrderById } from '@/modules/vendor/actions/sales-order-actions';
import { VendorOrderDetail } from './detail-view';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function VendorOrderDetailPage({ params }: PageProps) {
    const { id } = await params;
    const order = await getSalesOrderById(id);

    if (!order) {
        notFound();
    }

    return <VendorOrderDetail order={order} />;
}
