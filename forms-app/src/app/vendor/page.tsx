import { Metadata } from 'next';
import Image from 'next/image';
import { getVendorSessionOrThrow } from '@/modules/vendor/actions/auth-actions';
import { VendorDashboard } from './dashboard';
import { VendorHeader } from './header-user-menu';

export const metadata: Metadata = {
    title: 'Dashboard do Vendedor | Oligo Basics',
    description: 'Gerencie seus pedidos de vendas.',
};

export default async function VendorPage() {
    const session = await getVendorSessionOrThrow();

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header - Matching Admin style */}
            <div className="border-b bg-white dark:bg-zinc-950 px-6 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <Image
                        src="/logo.png"
                        alt="Oligo Basics"
                        width={150}
                        height={50}
                        className="h-8 w-auto"
                    />
                </div>
                <VendorHeader vendorName={session.name} />
            </div>

            <main className="p-8 max-w-7xl mx-auto space-y-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Gerencie seus pedidos de vendas e acompanhe o status.</p>
                </div>

                <VendorDashboard />
            </main>
        </div>
    );
}
