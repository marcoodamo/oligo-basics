import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SalesOrderForm } from './sales-order-form';

export const metadata: Metadata = {
    title: 'Novo Pedido de Vendas | Oligo Basics',
    description: 'Criar novo pedido de vendas.',
};

const VENDOR_SESSION_COOKIE = 'vendor_session';

async function getVendorSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(VENDOR_SESSION_COOKIE);

    if (!sessionCookie) {
        return null;
    }

    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

export default async function NovoPedidoPage() {
    const session = await getVendorSession();

    if (!session) {
        redirect('/vendor/login');
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/vendor" className="text-gray-500 hover:text-gray-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-800">Novo Pedido de Vendas</h1>
                                <p className="text-xs text-gray-500">Preencha todos os campos obrigatórios (*)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <SalesOrderForm />
            </main>
        </div>
    );
}
