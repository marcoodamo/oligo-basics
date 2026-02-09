'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export async function listAllSalesOrders() {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/login');
    }

    const orders = await prisma.salesOrder.findMany({
        include: {
            vendor: {
                select: {
                    name: true,
                    email: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
        id: order.id,
        customerOrderNumber: order.customerOrderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        status: order.status,
        total: order.total ? Number(order.total) : null,
        vendorName: order.vendor.name,
        vendorEmail: order.vendor.email,
        createdAt: order.createdAt,
    }));
}

export async function getSalesOrderById(id: string) {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
        throw new Error('Não autorizado');
    }

    const order = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            vendor: true,
            organization: true,
        },
    });

    if (!order) {
        throw new Error('Pedido não encontrado');
    }

    return order;
}

export async function deleteAdminSalesOrder(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
        return { success: false, error: 'Não autorizado' };
    }

    try {
        await prisma.salesOrder.delete({
            where: { id },
        });

        return { success: true };
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        return { success: false, error: 'Erro ao excluir pedido' };
    }
}
