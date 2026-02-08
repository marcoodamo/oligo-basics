import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { VendorManagement } from './vendor-management';

export const metadata: Metadata = {
    title: 'Gestão de Vendedores | Oligo Basics',
    description: 'Gerencie os vendedores da organização.',
};

export default async function VendedoresPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Gestão de Vendedores</h1>
                <p className="text-gray-500 mt-1">Crie e gerencie os vendedores da organização</p>
            </div>

            <VendorManagement />
        </div>
    );
}
