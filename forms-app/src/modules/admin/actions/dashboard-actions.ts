'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export interface DashboardStats {
    totalOrders: number;
    totalValue: number;
    totalVendors: number;
    ordersByStatus: {
        status: string;
        count: number;
    }[];
    ordersByVendor: {
        vendorName: string;
        orderCount: number;
        totalValue: number;
    }[];
    recentOrders: {
        id: string;
        customerOrderNumber: string;
        customerName: string;
        total: number | null;
        status: string;
        vendorName: string;
        createdAt: Date;
    }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/login');
    }

    // Total orders count
    const totalOrders = await prisma.salesOrder.count();

    // Total value of all orders
    const totalValueResult = await prisma.salesOrder.aggregate({
        _sum: {
            total: true,
        },
    });
    const totalValue = totalValueResult._sum.total ? Number(totalValueResult._sum.total) : 0;

    // Total vendors count
    const totalVendors = await prisma.vendor.count();

    // Orders by status
    const ordersByStatusRaw = await prisma.salesOrder.groupBy({
        by: ['status'],
        _count: {
            id: true,
        },
    });
    const ordersByStatus = ordersByStatusRaw.map((item) => ({
        status: item.status,
        count: item._count.id,
    }));

    // Orders by vendor (top 10)
    const ordersByVendorRaw = await prisma.salesOrder.groupBy({
        by: ['vendorId'],
        _count: {
            id: true,
        },
        _sum: {
            total: true,
        },
        orderBy: {
            _count: {
                id: 'desc',
            },
        },
        take: 10,
    });

    // Get vendor names
    const vendorIds = ordersByVendorRaw.map((item) => item.vendorId);
    const vendors = await prisma.vendor.findMany({
        where: { id: { in: vendorIds } },
        select: { id: true, name: true },
    });
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    const ordersByVendor = ordersByVendorRaw.map((item) => ({
        vendorName: vendorMap.get(item.vendorId) || 'Desconhecido',
        orderCount: item._count.id,
        totalValue: item._sum.total ? Number(item._sum.total) : 0,
    }));

    // Recent orders (last 5)
    const recentOrdersRaw = await prisma.salesOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            vendor: {
                select: { name: true },
            },
        },
    });

    const recentOrders = recentOrdersRaw.map((order) => ({
        id: order.id,
        customerOrderNumber: order.customerOrderNumber,
        customerName: order.customerName,
        total: order.total ? Number(order.total) : null,
        status: order.status,
        vendorName: order.vendor.name,
        createdAt: order.createdAt,
    }));

    return {
        totalOrders,
        totalValue,
        totalVendors,
        ordersByStatus,
        ordersByVendor,
        recentOrders,
    };
}
