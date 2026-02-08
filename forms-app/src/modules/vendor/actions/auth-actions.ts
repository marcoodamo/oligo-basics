'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { VendorLoginInput } from '../types';

const VENDOR_SESSION_COOKIE = 'vendor_session';

export async function vendorLogin(input: VendorLoginInput) {
    const vendor = await prisma.vendor.findUnique({
        where: { email: input.email },
        include: { organization: true },
    });

    if (!vendor) {
        throw new Error('Credenciais inválidas');
    }

    const isValid = await bcrypt.compare(input.password, vendor.passwordHash);

    if (!isValid) {
        throw new Error('Credenciais inválidas');
    }

    // Create session
    const session = {
        vendorId: vendor.id,
        organizationId: vendor.organizationId,
        name: vendor.name,
        email: vendor.email,
    };

    const cookieStore = await cookies();
    cookieStore.set(VENDOR_SESSION_COOKIE, JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
    });
}

export async function vendorLogout() {
    const cookieStore = await cookies();
    cookieStore.delete(VENDOR_SESSION_COOKIE);
    redirect('/vendor/login');
}

export async function getVendorSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(VENDOR_SESSION_COOKIE);

    if (!sessionCookie) return null;

    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

export async function getVendorSessionOrThrow() {
    const session = await getVendorSession();
    if (!session) {
        redirect('/vendor/login');
    }
    return session;
}
