'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getDashboardStats, type DashboardStats } from '@/modules/admin/actions/dashboard-actions';
import { format } from 'date-fns';
import {
    ShoppingCart,
    DollarSign,
    Users,
    TrendingUp,
    Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    DRAFT: { label: 'Rascunho', variant: 'secondary' },
    SUBMITTED: { label: 'Enviado', variant: 'default' },
    APPROVED: { label: 'Aprovado', variant: 'outline' },
    REJECTED: { label: 'Rejeitado', variant: 'destructive' },
};

const STATUS_COLORS: Record<string, string> = {
    DRAFT: '#6b7280',
    SUBMITTED: '#3b82f6',
    APPROVED: '#10b981',
    REJECTED: '#ef4444',
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        try {
            const data = await getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function formatCurrency(value: number) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center text-muted-foreground">
                Erro ao carregar dados do dashboard.
            </div>
        );
    }

    const statusChartData = stats.ordersByStatus.map((item) => ({
        name: statusLabels[item.status]?.label || item.status,
        value: item.count,
        color: STATUS_COLORS[item.status] || '#6b7280',
    }));

    const vendorChartData = stats.ordersByVendor.map((item, index) => ({
        name: item.vendorName.length > 15 ? item.vendorName.substring(0, 15) + '...' : item.vendorName,
        pedidos: item.orderCount,
        valor: item.totalValue,
        fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">
                    Visão geral dos pedidos e vendedores
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalOrders}</div>
                        <p className="text-xs text-muted-foreground">
                            pedidos registrados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
                        <p className="text-xs text-muted-foreground">
                            em todos os pedidos
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalVendors}</div>
                        <p className="text-xs text-muted-foreground">
                            vendedores cadastrados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.totalOrders > 0 ? formatCurrency(stats.totalValue / stats.totalOrders) : 'R$ 0,00'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            por pedido
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Orders by Vendor Bar Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pedidos por Vendedor</CardTitle>
                        <CardDescription>Top 10 vendedores por quantidade de pedidos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {vendorChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={vendorChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value, name) => [
                                            name === 'pedidos' ? `${value} pedidos` : formatCurrency(Number(value)),
                                            name === 'pedidos' ? 'Quantidade' : 'Valor Total',
                                        ]}
                                    />
                                    <Bar dataKey="pedidos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                Nenhum pedido encontrado
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Orders by Status Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Status dos Pedidos</CardTitle>
                        <CardDescription>Distribuição por status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statusChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={statusChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {statusChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value} pedidos`, 'Quantidade']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                Nenhum pedido encontrado
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Orders Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Pedidos Recentes</CardTitle>
                        <CardDescription>Últimos 5 pedidos registrados</CardDescription>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/pedidos">Ver Todos</Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Nº Pedido</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead className="text-right pr-6">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.recentOrders.length > 0 ? (
                                stats.recentOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium pl-6">
                                            {order.customerOrderNumber}
                                        </TableCell>
                                        <TableCell>{order.customerName}</TableCell>
                                        <TableCell>{order.vendorName}</TableCell>
                                        <TableCell>
                                            {order.total ? formatCurrency(order.total) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusLabels[order.status]?.variant || 'secondary'}>
                                                {statusLabels[order.status]?.label || order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(order.createdAt), 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Link href={`/pedidos/${order.id}`}>
                                                <Button variant="ghost" size="icon">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        Nenhum pedido encontrado
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
