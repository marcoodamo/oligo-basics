'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listAllSalesOrders, deleteAdminSalesOrder } from '@/modules/admin/actions/order-actions';
import { format } from 'date-fns';
import { Eye, Trash2 } from 'lucide-react';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

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
    const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    async function handleDelete(id: string) {
        setDeletingId(id);
        try {
            const result = await deleteAdminSalesOrder(id);
            if (result.success) {
                toast.success('Pedido excluído com sucesso!');
                setOrders(orders.filter(o => o.id !== id));
            } else {
                toast.error(result.error || 'Erro ao excluir pedido');
            }
        } catch (error) {
            console.error('Erro ao excluir pedido:', error);
            toast.error('Erro ao excluir pedido');
        } finally {
            setDeletingId(null);
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
            <div>
                <h1 className="text-3xl font-bold">Pedidos</h1>
                <p className="text-muted-foreground">Gerencie todos os pedidos da plataforma.</p>
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
                                    <TableCell>{order.customerName}</TableCell>
                                    <TableCell>
                                        {format(new Date(order.orderDate), 'dd/MM/yyyy')}
                                    </TableCell>
                                    <TableCell>{formatCurrency(order.total)}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusLabels[order.status]?.variant || 'secondary'}>
                                            {statusLabels[order.status]?.label || order.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-1">
                                            <Link href={`/pedidos/${order.id}`}>
                                                <Button variant="ghost" size="icon" title="Visualizar">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Excluir"
                                                        disabled={deletingId === order.id}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Tem certeza que deseja excluir o pedido <strong>{order.customerOrderNumber}</strong>?
                                                            <br /><br />
                                                            Esta ação não pode ser desfeita.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(order.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Excluir
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
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
