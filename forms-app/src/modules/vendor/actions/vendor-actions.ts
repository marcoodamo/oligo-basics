'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import type { VendorItem, VendorDetail, CreateVendorInput, UpdateVendorInput } from '../types';

async function getSessionOrThrow() {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Não autorizado');
    }
    return session;
}

async function requireAdmin() {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
    }
    return session;
}

// ============================================
// Vendor CRUD (Admin only)
// ============================================

export async function createVendor(input: CreateVendorInput): Promise<VendorItem> {
    const session = await requireAdmin();

    // Check if email already exists
    const existing = await prisma.vendor.findUnique({
        where: { email: input.email },
    });

    if (existing) {
        throw new Error('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const vendor = await prisma.vendor.create({
        data: {
            name: input.name,
            email: input.email,
            passwordHash,
            phone: input.phone,
            organizationId: session.user.organizationId,
        },
    });

    revalidatePath('/admin');

    return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        active: vendor.active,
        createdAt: vendor.createdAt,
    };
}

export async function updateVendor(id: string, input: UpdateVendorInput): Promise<VendorItem> {
    await requireAdmin();

    const data: Record<string, unknown> = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.active !== undefined) data.active = input.active;
    if (input.password) {
        data.passwordHash = await bcrypt.hash(input.password, 10);
    }

    const vendor = await prisma.vendor.update({
        where: { id },
        data,
    });

    revalidatePath('/admin');

    return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        active: vendor.active,
        createdAt: vendor.createdAt,
    };
}

export async function listVendors(): Promise<VendorItem[]> {
    const session = await requireAdmin();

    const vendors = await prisma.vendor.findMany({
        where: {
            organizationId: session.user.organizationId,
        },
        include: {
            _count: {
                select: { salesOrders: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return vendors.map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        active: v.active,
        createdAt: v.createdAt,
        salesOrderCount: v._count.salesOrders,
    }));
}

export async function getVendorById(id: string): Promise<VendorDetail | null> {
    await requireAdmin();

    const vendor = await prisma.vendor.findUnique({
        where: { id },
    });

    if (!vendor) return null;

    return {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        active: vendor.active,
        organizationId: vendor.organizationId,
        createdAt: vendor.createdAt,
    };
}

export async function deactivateVendor(id: string): Promise<void> {
    await requireAdmin();

    await prisma.vendor.update({
        where: { id },
        data: { active: false },
    });

    revalidatePath('/admin');
}

export async function activateVendor(id: string): Promise<void> {
    await requireAdmin();

    await prisma.vendor.update({
        where: { id },
        data: { active: true },
    });

    revalidatePath('/admin');
}

export async function deleteVendor(id: string): Promise<void> {
    await requireAdmin();

    // Check for sales orders
    const orderCount = await prisma.salesOrder.count({
        where: { vendorId: id },
    });

    if (orderCount > 0) {
        throw new Error('Não é possível excluir vendedor com pedidos. Desative-o.');
    }

    await prisma.vendor.delete({
        where: { id },
    });

    revalidatePath('/admin');
}

// ============================================
// Vendor Authentication
// ============================================

export async function authenticateVendor(email: string, password: string) {
    const vendor = await prisma.vendor.findUnique({
        where: { email },
        include: { organization: true },
    });

    if (!vendor) {
        return null;
    }

    if (!vendor.active) {
        return null;
    }

    const isValid = await bcrypt.compare(password, vendor.passwordHash);

    if (!isValid) {
        return null;
    }

    return {
        id: vendor.id,
        email: vendor.email,
        name: vendor.name,
        role: 'VENDOR' as const,
        organizationId: vendor.organizationId,
        organizationName: vendor.organization.name,
    };
}
