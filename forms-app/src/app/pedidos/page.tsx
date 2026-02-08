'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listAllSalesOrders } from '@/modules/admin/actions/order-actions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AdminOrderListItem {
    id: string;
    customerOrderNumber: string;
    customerName: string;
    orderDate: Date;
    status: string;
    total: number | null;
    vendorName: string;
    vendorEmail: string;
    createdAt: Date;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    DRAFT: { label: 'Rascunho', variant: 'secondary' },
    SUBMITTED: { label: 'Enviado', variant: 'default' },
    APPROVED: { label: 'Aprovado', variant: 'outline' },
    REJECTED: { label: 'Rejeitado', variant: 'destructive' },
};

export default function AdminOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadOrders();
    }, []);

    async function loadOrders() {
        try {
            const data = await listAllSalesOrders();
            setOrders(data);
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function formatCurrency(value: number | null) {
        if (value === null) return '-';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pedidos de Vendas</h1>
                    <p className="text-muted-foreground">Gerencie todos os pedidos da plataforma.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Listagem de Pedidos</CardTitle>
                    <CardDescription>{orders.length} pedidos encontrados</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Nº Pedido</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium pl-6">
                                        {order.customerOrderNumber}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{order.vendorName}</span>
                                            <span className="text-xs text-muted-foreground">{order.vendorEmail}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {order.customerName}
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(order.orderDate), 'dd/MM/yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        {formatCurrency(order.total)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusLabels[order.status]?.variant || 'secondary'}>
                                            {statusLabels[order.status]?.label || order.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Link href={`/pedidos/${order.id}`}>
                                            <Button variant="ghost" size="icon">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
