import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticateVendor } from '@/modules/vendor/actions/vendor-actions';

const VENDOR_SESSION_COOKIE = 'vendor_session';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'E-mail e senha são obrigatórios' },
                { status: 400 }
            );
        }

        const vendor = await authenticateVendor(email, password);

        if (!vendor) {
            return NextResponse.json(
                { error: 'Credenciais inválidas' },
                { status: 401 }
            );
        }

        // Set vendor session cookie
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
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return NextResponse.json({
            success: true,
            vendor: {
                id: vendor.id,
                name: vendor.name,
                email: vendor.email,
            },
        });
    } catch (error) {
        console.error('[VENDOR LOGIN]', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
