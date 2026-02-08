'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listSalesOrders, deleteSalesOrder, submitSalesOrder } from '@/modules/vendor/actions/sales-order-actions';
import type { SalesOrderListItem } from '@/modules/vendor/types';
import { Pencil, Trash2, Send, Plus, ShoppingBag, Eye, FileText, CheckCircle, Clock } from 'lucide-react';
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
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    DRAFT: { label: 'Rascunho', variant: 'secondary' },
    SUBMITTED: { label: 'Enviado', variant: 'default' },
    APPROVED: { label: 'Aprovado', variant: 'outline' },
    REJECTED: { label: 'Rejeitado', variant: 'destructive' },
};

export function VendorDashboard() {
    const [orders, setOrders] = useState<SalesOrderListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadOrders();
    }, []);

    async function loadOrders() {
        try {
            const data = await listSalesOrders();
            setOrders(data);
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
            toast.error("Erro ao carregar pedidos");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSubmit(id: string) {
        if (!confirm('Deseja enviar este pedido? Após enviado, não poderá mais ser editado.')) {
            return;
        }

        setProcessingId(id);
        try {
            await submitSalesOrder(id);
            toast.success("Pedido enviado com sucesso!");
            await loadOrders();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao enviar pedido');
        } finally {
            setProcessingId(null);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Deseja excluir este rascunho?')) {
            return;
        }

        setProcessingId(id);
        try {
            await deleteSalesOrder(id);
            toast.success("Rascunho excluído");
            await loadOrders();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao excluir pedido');
        } finally {
            setProcessingId(null);
        }
    }

    function formatDate(date: Date) {
        return new Date(date).toLocaleDateString('pt-BR');
    }

    function formatCurrency(value: number | null) {
        if (value === null) return '-';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Calculate Summary Stats
    const totalOrders = orders.length;
    const openOrders = orders.filter(o => o.status === 'DRAFT' || o.status === 'SUBMITTED').length;
    const approvedOrders = orders.filter(o => o.status === 'APPROVED').length;
    const totalValue = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nenhum pedido encontrado</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Você ainda não criou nenhum pedido de vendas. Comece agora mesmo.
                    </p>
                    <Link href="/vendor/novo-pedido">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Pedido
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrders}</div>
                        <p className="text-xs text-muted-foreground">Pedidos realizados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
                        <p className="text-xs text-muted-foreground">Em vendas (aprox.)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{openOrders}</div>
                        <p className="text-xs text-muted-foreground">Rascunhos ou Enviados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{approvedOrders}</div>
                        <p className="text-xs text-muted-foreground">Pedidos finalizados</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle>Meus Pedidos</CardTitle>
                    <Link href="/vendor/novo-pedido">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Pedido
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Nº Pedido</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Data Pedido</TableHead>
                                <TableHead>Entrega</TableHead>
                                <TableHead>Itens</TableHead>
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
                                    <TableCell className="text-muted-foreground">
                                        {order.customerName}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(order.orderDate)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(order.requestedDeliveryDate)}
                                    </TableCell>
                                    <TableCell>
                                        {order.itemCount}
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
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/vendor/pedidos/${order.id}`}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                            {order.status === 'DRAFT' && (
                                                <>
                                                    <Link href={`/vendor/pedidos/${order.id}/editar`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:text-blue-600"
                                                            disabled={processingId === order.id}
                                                            title="Editar"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:text-green-600"
                                                        onClick={() => handleSubmit(order.id)}
                                                        disabled={processingId === order.id}
                                                        title="Enviar"
                                                    >
                                                        {processingId === order.id ? (
                                                            <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Send className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:text-red-600"
                                                        onClick={() => handleDelete(order.id)}
                                                        disabled={processingId === order.id}
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
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

