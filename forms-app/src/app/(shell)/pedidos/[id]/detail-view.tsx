'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    DRAFT: { label: 'Rascunho', variant: 'secondary' },
    SUBMITTED: { label: 'Enviado', variant: 'default' },
    APPROVED: { label: 'Aprovado', variant: 'outline' },
    REJECTED: { label: 'Rejeitado', variant: 'destructive' },
};

export function AdminOrderDetail({ order }: { order: any }) {
    const [activeTab, setActiveTab] = useState("visual");
    const items = (order.items as any[]) ?? [];

    function formatCurrency(value: number | null) {
        if (value === null) return '-';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: order.currency || 'BRL' });
    }

    function formatDate(date: Date | string | null) {
        if (!date) return '-';
        return format(new Date(date), 'dd/MM/yyyy');
    }

    const handleDownloadJson = () => {
        const jsonString = JSON.stringify(order, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `pedido_${order.customerOrderNumber || order.id}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/pedidos">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Pedido {order.customerOrderNumber}</h1>
                        <Badge variant={statusLabels[order.status]?.variant || 'secondary'}>
                            {statusLabels[order.status]?.label || order.status}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        {order.vendor?.name} • {formatDate(order.createdAt)}
                    </p>
                </div>
                <Button variant="outline" onClick={handleDownloadJson}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar JSON
                </Button>
            </div>

            <Tabs defaultValue="visual" className="w-full" onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="visual">Visualização</TabsTrigger>
                    <TabsTrigger value="json">JSON (Raw)</TabsTrigger>
                </TabsList>

                <TabsContent value="visual" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Cliente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold">{order.customerName}</div>
                                <p className="text-sm text-muted-foreground">{order.customerCnpj}</p>
                                <p className="text-sm text-muted-foreground">{order.customerCity} - {order.customerState}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Datas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Emissão:</span>
                                    <span className="font-medium">{formatDate(order.orderDate)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Entrega:</span>
                                    <span className="font-medium">{formatDate(order.requestedDeliveryDate)}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Totais</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-primary">{formatCurrency(order.total)}</div>
                                <p className="text-sm text-muted-foreground">{items.length} itens</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Itens do Pedido</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">Código</th>
                                            <th className="px-4 py-3 text-left font-medium">Descrição</th>
                                            <th className="px-4 py-3 text-right font-medium">Qtd</th>
                                            <th className="px-4 py-3 text-left font-medium">Un</th>
                                            <th className="px-4 py-3 text-right font-medium">Preço Unit.</th>
                                            <th className="px-4 py-3 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item: any, i: number) => (
                                            <tr key={i} className="border-b hover:bg-muted/50">
                                                <td className="px-4 py-3">{item.productCode || item.itemNumber}</td>
                                                <td className="px-4 py-3">{item.description}</td>
                                                <td className="px-4 py-3 text-right">{item.quantity}</td>
                                                <td className="px-4 py-3">{item.unitOfMeasure}</td>
                                                <td className="px-4 py-3 text-right">{formatCurrency(Number(item.unitPrice))}</td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatCurrency(Number(item.unitPrice) * Number(item.quantity))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Endereço de Entrega</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <p>{order.shipToStreet}, {order.shipToNumber}</p>
                                <p>{order.shipToDistrict}</p>
                                <p>{order.shipToCity} - {order.shipToState}</p>
                                <p>CEP: {order.shipToZip}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Pagamento & Frete</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-muted-foreground">Condição:</span>
                                    <span>{order.paymentTermDays} dias</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-muted-foreground">Frete:</span>
                                    <span>{order.freightMode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Transportadora:</span>
                                    <span>{order.carrier || '-'}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="json">
                    <Card>
                        <CardContent className="p-0">
                            <pre className="text-xs bg-zinc-950 text-zinc-50 p-4 rounded-md overflow-auto max-h-[600px] font-mono">
                                {JSON.stringify(order, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
