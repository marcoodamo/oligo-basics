'use server';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type {
    SalesOrderListItem,
    SalesOrderDetail,
    CreateSalesOrderInput,
    SalesOrderItem
} from '../types';

const VENDOR_SESSION_COOKIE = 'vendor_session';

interface VendorSession {
    vendorId: string;
    organizationId: string;
    name: string;
    email: string;
}

async function getVendorSessionOrThrow(): Promise<VendorSession> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(VENDOR_SESSION_COOKIE);

    if (!sessionCookie) {
        throw new Error('Vendedor não autenticado');
    }

    try {
        return JSON.parse(sessionCookie.value) as VendorSession;
    } catch {
        throw new Error('Sessão inválida');
    }
}

// ============================================
// Sales Order CRUD
// ============================================

export async function createSalesOrder(input: CreateSalesOrderInput): Promise<string> {
    const session = await getVendorSessionOrThrow();

    const order = await prisma.salesOrder.create({
        data: {
            vendorId: session.vendorId,
            organizationId: session.organizationId,

            // Seção 1
            customerOrderNumber: input.customerOrderNumber,
            orderDate: new Date(input.orderDate),
            requestedDeliveryDate: new Date(input.requestedDeliveryDate),
            promisedDeliveryDate: input.promisedDeliveryDate ? new Date(input.promisedDeliveryDate) : null,
            invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,

            // Seção 2
            customerName: input.customerName,
            customerCnpj: input.customerCnpj,
            customerIe: input.customerIe,
            customerPhone: input.customerPhone,
            customerEmail: input.customerEmail,
            customerContact: input.customerContact,

            // Seção 3
            billToStreet: input.billToStreet,
            billToNumber: input.billToNumber,
            billToComplement: input.billToComplement,
            billToDistrict: input.billToDistrict,
            billToCity: input.billToCity,
            billToState: input.billToState,
            billToZip: input.billToZip,
            billToCountry: input.billToCountry || 'Brasil',

            // Seção 4
            sameAsBillTo: input.sameAsBillTo,
            shipToStreet: input.shipToStreet,
            shipToNumber: input.shipToNumber,
            shipToComplement: input.shipToComplement,
            shipToDistrict: input.shipToDistrict,
            shipToCity: input.shipToCity,
            shipToState: input.shipToState,
            shipToZip: input.shipToZip,
            shipToCountry: input.shipToCountry,

            // Seção 5
            items: input.items,

            // Seção 6
            paymentTermDays: input.paymentTermDays,
            paymentDaysOfMonth: input.paymentDaysOfMonth,
            paymentMethod: input.paymentMethod,
            subtotal: input.subtotal,
            discounts: input.discounts,
            freight: input.freight,
            taxes: input.taxes,
            total: input.total,

            // Seção 7
            currency: input.currency || 'BRL',
            bankAccountCode: input.bankAccountCode,
            viaDeposit: input.viaDeposit || false,

            // Seção 8
            freightMode: input.freightMode,
            carrier: input.carrier,
            deliveryInstructions: input.deliveryInstructions,

            // Seção 9
            notes: input.notes,

            status: 'DRAFT',
        },
    });

    revalidatePath('/vendor');

    return order.id;
}

export async function updateSalesOrder(id: string, input: CreateSalesOrderInput): Promise<void> {
    const session = await getVendorSessionOrThrow();

    const existingOrder = await prisma.salesOrder.findFirst({
        where: {
            id,
            vendorId: session.vendorId,
            status: 'DRAFT',
        },
    });

    if (!existingOrder) {
        throw new Error('Pedido não encontrado ou não pode ser editado (apenas rascunhos podem ser alterados)');
    }

    await prisma.salesOrder.update({
        where: { id },
        data: {
            // Seção 1
            customerOrderNumber: input.customerOrderNumber,
            orderDate: new Date(input.orderDate),
            requestedDeliveryDate: new Date(input.requestedDeliveryDate),
            promisedDeliveryDate: input.promisedDeliveryDate ? new Date(input.promisedDeliveryDate) : null,
            invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,

            // Seção 2
            customerName: input.customerName,
            customerCnpj: input.customerCnpj,
            customerIe: input.customerIe,
            customerPhone: input.customerPhone,
            customerEmail: input.customerEmail,
            customerContact: input.customerContact,

            // Seção 3
            billToStreet: input.billToStreet,
            billToNumber: input.billToNumber,
            billToComplement: input.billToComplement,
            billToDistrict: input.billToDistrict,
            billToCity: input.billToCity,
            billToState: input.billToState,
            billToZip: input.billToZip,
            billToCountry: input.billToCountry || 'Brasil',

            // Seção 4
            sameAsBillTo: input.sameAsBillTo,
            shipToStreet: input.shipToStreet,
            shipToNumber: input.shipToNumber,
            shipToComplement: input.shipToComplement,
            shipToDistrict: input.shipToDistrict,
            shipToCity: input.shipToCity,
            shipToState: input.shipToState,
            shipToZip: input.shipToZip,
            shipToCountry: input.shipToCountry,

            // Seção 5
            items: input.items,

            // Seção 6
            paymentTermDays: input.paymentTermDays,
            paymentDaysOfMonth: input.paymentDaysOfMonth,
            paymentMethod: input.paymentMethod,
            subtotal: input.subtotal,
            discounts: input.discounts,
            freight: input.freight,
            taxes: input.taxes,
            total: input.total,

            // Seção 7
            currency: input.currency || 'BRL',
            bankAccountCode: input.bankAccountCode,
            viaDeposit: input.viaDeposit || false,

            // Seção 8
            freightMode: input.freightMode,
            carrier: input.carrier,
            deliveryInstructions: input.deliveryInstructions,

            // Seção 9
            notes: input.notes,
        },
    });

    revalidatePath('/vendor');
}

export async function listSalesOrders(): Promise<SalesOrderListItem[]> {
    const session = await getVendorSessionOrThrow();

    const orders = await prisma.salesOrder.findMany({
        where: {
            vendorId: session.vendorId,
        },
        orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
        id: order.id,
        customerOrderNumber: order.customerOrderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        requestedDeliveryDate: order.requestedDeliveryDate,
        status: order.status as SalesOrderListItem['status'],
        total: order.total ? Number(order.total) : null,
        itemCount: (order.items as SalesOrderItem[]).length,
        createdAt: order.createdAt,
    }));
}

export async function getSalesOrderById(id: string): Promise<SalesOrderDetail | null> {
    const session = await getVendorSessionOrThrow();

    const order = await prisma.salesOrder.findFirst({
        where: {
            id,
            vendorId: session.vendorId,
        },
        include: {
            vendor: { select: { name: true } },
        },
    });

    if (!order) return null;

    return {
        id: order.id,
        status: order.status as SalesOrderDetail['status'],

        customerOrderNumber: order.customerOrderNumber,
        orderDate: order.orderDate,
        requestedDeliveryDate: order.requestedDeliveryDate,
        promisedDeliveryDate: order.promisedDeliveryDate,
        invoiceDate: order.invoiceDate,

        customerName: order.customerName,
        customerCnpj: order.customerCnpj,
        customerIe: order.customerIe,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        customerContact: order.customerContact,

        billToStreet: order.billToStreet,
        billToNumber: order.billToNumber,
        billToComplement: order.billToComplement,
        billToDistrict: order.billToDistrict,
        billToCity: order.billToCity,
        billToState: order.billToState,
        billToZip: order.billToZip,
        billToCountry: order.billToCountry,

        sameAsBillTo: order.sameAsBillTo,
        shipToStreet: order.shipToStreet,
        shipToNumber: order.shipToNumber,
        shipToComplement: order.shipToComplement,
        shipToDistrict: order.shipToDistrict,
        shipToCity: order.shipToCity,
        shipToState: order.shipToState,
        shipToZip: order.shipToZip,
        shipToCountry: order.shipToCountry,

        items: order.items as SalesOrderItem[],

        paymentTermDays: order.paymentTermDays,
        paymentDaysOfMonth: order.paymentDaysOfMonth,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal ? Number(order.subtotal) : null,
        discounts: order.discounts ? Number(order.discounts) : null,
        freight: order.freight ? Number(order.freight) : null,
        taxes: order.taxes ? Number(order.taxes) : null,
        total: order.total ? Number(order.total) : null,

        currency: order.currency,
        bankAccountCode: order.bankAccountCode,
        viaDeposit: order.viaDeposit,

        freightMode: order.freightMode,
        carrier: order.carrier,
        deliveryInstructions: order.deliveryInstructions,

        notes: order.notes,

        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };
}

export async function submitSalesOrder(id: string): Promise<void> {
    const session = await getVendorSessionOrThrow();

    const order = await prisma.salesOrder.findFirst({
        where: {
            id,
            vendorId: session.vendorId,
            status: 'DRAFT',
        },
    });

    if (!order) {
        throw new Error('Pedido não encontrado ou já submetido');
    }

    await prisma.salesOrder.update({
        where: { id },
        data: { status: 'SUBMITTED' },
    });

    revalidatePath('/vendor');
}

export async function deleteSalesOrder(id: string): Promise<void> {
    const session = await getVendorSessionOrThrow();

    const order = await prisma.salesOrder.findFirst({
        where: {
            id,
            vendorId: session.vendorId,
            status: 'DRAFT',
        },
    });

    if (!order) {
        throw new Error('Apenas rascunhos podem ser excluídos');
    }

    await prisma.salesOrder.delete({
        where: { id },
    });

    revalidatePath('/vendor');
}
