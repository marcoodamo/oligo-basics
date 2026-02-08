import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const VENDOR_SESSION_COOKIE = 'vendor_session';

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete(VENDOR_SESSION_COOKIE);

    return NextResponse.json({ success: true });
}
