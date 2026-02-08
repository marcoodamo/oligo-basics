"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
    Upload,
    FileText,
    Download,
    AlertTriangle,
    Calendar,
    RotateCcw,
    Loader2,
    Trash2,
    Clock,
    Eye,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    XCircle,
    History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    saveParserProcessing,
    getParserHistory,
    getParserProcessingById,
    deleteParserProcessing,
} from "@/modules/parser/actions/parser-actions";
import type { ParserProcessingItem } from "@/modules/parser/types";

const API_BASE = process.env.NEXT_PUBLIC_PARSER_API_URL || "http://localhost:8000";

interface OrderData {
    customer_order_number?: string;
    order_date?: string;
    requested_delivery_date?: string;
    customer_name?: string;
    customer_cnpj?: string;
    sell_to?: { name?: string; cnpj?: string };
    payment_terms_code?: string;
    total_amount?: number;
    currency?: string;
    [key: string]: any;
}

interface OrderLine {
    item_reference_no?: string;
    description?: string;
    quantity?: number;
    unit_of_measure?: string;
    unit_price_excl_vat?: number;
    line_amount?: number;
    [key: string]: any;
}

interface SplitOrder {
    delivery_date: string;
    order: OrderData;
    lines: OrderLine[];
}

interface ParseResult {
    order: OrderData;
    lines: OrderLine[];
    warnings: string[];
    document_type: string;
    split_orders: SplitOrder[];
    has_multiple_dates: boolean;
}

export default function ParserPage() {
    const [file, setFile] = useState<File | null>(null);
    const [text, setText] = useState("");
    const [result, setResult] = useState<ParseResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"dados" | "linhas" | "json">("dados");
    const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // History state
    const [history, setHistory] = useState<ParserProcessingItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [historyDetail, setHistoryDetail] = useState<any>(null);
    const [showHistory, setShowHistory] = useState(true);

    // Load history on mount
    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await getParserHistory(50);
            setHistory(data as ParserProcessingItem[]);
        } catch (err) {
            console.error("Failed to load history:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile?.type === "application/pdf") {
            setFile(droppedFile);
            setText("");
            setError(null);
        } else {
            setError("Por favor, envie um arquivo PDF");
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setText("");
            setError(null);
        }
    };

    const handleProcess = async () => {
        if (!file && !text.trim()) {
            setError("Por favor, envie um PDF ou cole o texto do pedido");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        const startTime = Date.now();

        try {
            let response: Response;

            if (file) {
                const formData = new FormData();
                formData.append("file", file);
                response = await fetch(`${API_BASE}/parse`, {
                    method: "POST",
                    body: formData,
                });
            } else {
                response = await fetch(`${API_BASE}/parse/text`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Erro: ${response.status}`);
            }

            const data = await response.json();
            const processingTime = Date.now() - startTime;

            setResult(data);
            setSelectedOrderIndex(0);

            // Save to history
            if (file) {
                await saveParserProcessing(file.name, file.size, data, processingTime);
                await loadHistory();
            }

            toast.success("Pedido processado com sucesso!");
        } catch (err: any) {
            setError(err.message || "Ocorreu um erro ao processar");
            toast.error("Erro ao processar pedido");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!result) return;

        const jsonData = {
            order: displayOrder,
            lines: displayLines,
        };

        const orderNum = displayOrder?.customer_order_number || "pedido";
        const filename = `${orderNum}_extraido.json`;

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        setFile(null);
        setText("");
        setResult(null);
        setError(null);
        setSelectedOrderIndex(0);
    };

    const handleViewHistory = async (id: string) => {
        try {
            const detail = await getParserProcessingById(id);
            setHistoryDetail(detail);
            setSelectedHistoryId(id);
        } catch (err) {
            toast.error("Erro ao carregar detalhes");
        }
    };

    const handleDeleteHistory = async (id: string) => {
        try {
            await deleteParserProcessing(id);
            await loadHistory();
            if (selectedHistoryId === id) {
                setSelectedHistoryId(null);
                setHistoryDetail(null);
            }
            toast.success("Processamento excluído");
        } catch (err) {
            toast.error("Erro ao excluir");
        }
    };

    const displayOrder = result?.has_multiple_dates
        ? result.split_orders[selectedOrderIndex]?.order
        : result?.order;
    const displayLines = result?.has_multiple_dates
        ? result.split_orders[selectedOrderIndex]?.lines
        : result?.lines;

    const formatCurrency = (value: number | undefined, currency: string = "BRL") => {
        if (value === undefined) return "-";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency,
        }).format(value);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(date));
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Parser de Pedidos</h1>
                    <p className="text-muted-foreground">
                        Extração automática de dados de PDFs LAR e BRF
                    </p>
                </div>
                {result && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClear}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Novo Pedido
                        </Button>
                        <Button onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar JSON
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Enviar Pedido
                        </CardTitle>
                        <CardDescription>
                            Arraste um PDF ou cole o texto do pedido
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragOver
                                    ? "border-primary bg-primary/5"
                                    : "border-muted-foreground/25 hover:border-primary/50"
                                }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragOver(true);
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium">Arraste e solte seu PDF aqui</p>
                            <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>

                            {file && (
                                <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md text-sm">
                                    📄 {file.name} ({formatFileSize(file.size)})
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">ou</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cole o texto do pedido</label>
                            <textarea
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    setFile(null);
                                }}
                                placeholder="Cole aqui o conteúdo do pedido..."
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                        <Button
                            className="w-full"
                            onClick={handleProcess}
                            disabled={loading || (!file && !text.trim())}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                "Processar Pedido"
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Results Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Dados Extraídos</CardTitle>
                        {result && (
                            <div className="flex gap-2">
                                <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                                    {result.document_type === "purchase_order"
                                        ? "Pedido de Compra"
                                        : result.document_type === "email"
                                            ? "E-mail"
                                            : "Documento"}
                                </span>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        {!result ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <FileText className="h-12 w-12 mb-4" />
                                <p>Envie um PDF ou cole o texto para ver os dados extraídos</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {result.warnings && result.warnings.length > 0 && (
                                    <div className="space-y-2">
                                        {result.warnings.map((warning, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-yellow-700 text-sm"
                                            >
                                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                                {warning}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {result.has_multiple_dates && (
                                    <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                                        <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                                            <Calendar className="h-4 w-4" />
                                            Este pedido possui {result.split_orders.length} datas de entrega
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {result.split_orders.map((splitOrder, idx) => (
                                                <Button
                                                    key={idx}
                                                    size="sm"
                                                    variant={selectedOrderIndex === idx ? "default" : "outline"}
                                                    onClick={() => setSelectedOrderIndex(idx)}
                                                >
                                                    {splitOrder.delivery_date || "Sem data"}
                                                    <span className="ml-2 text-xs opacity-70">
                                                        ({splitOrder.lines?.length || 0} itens)
                                                    </span>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-1 border-b">
                                    {(["dados", "linhas", "json"] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab
                                                    ? "border-primary text-primary"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                                }`}
                                            onClick={() => setActiveTab(tab)}
                                        >
                                            {tab === "dados" ? "Dados" : tab === "linhas" ? "Itens" : "JSON"}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === "dados" && displayOrder && (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Nº Pedido</span>
                                            <p className="font-medium">{displayOrder.customer_order_number || "-"}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Data</span>
                                            <p className="font-medium">{displayOrder.order_date || "-"}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Entrega</span>
                                            <p className="font-medium">{displayOrder.requested_delivery_date || "-"}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Pagamento</span>
                                            <p className="font-medium">{displayOrder.payment_terms_code || "-"}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">Cliente</span>
                                            <p className="font-medium">
                                                {displayOrder.sell_to?.name || displayOrder.customer_name || "-"}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">CNPJ</span>
                                            <p className="font-medium">
                                                {displayOrder.sell_to?.cnpj || displayOrder.customer_cnpj || "-"}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {activeTab === "linhas" && displayLines && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2 font-medium">Código</th>
                                                    <th className="text-left py-2 font-medium">Descrição</th>
                                                    <th className="text-right py-2 font-medium">Qtd</th>
                                                    <th className="text-left py-2 font-medium">Un</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {displayLines.map((line, i) => (
                                                    <tr key={i} className="border-b">
                                                        <td className="py-2">{line.item_reference_no || "-"}</td>
                                                        <td className="py-2 max-w-[200px] truncate">{line.description || "-"}</td>
                                                        <td className="py-2 text-right">{line.quantity || "-"}</td>
                                                        <td className="py-2">{line.unit_of_measure || "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="text-right mt-2 text-sm text-muted-foreground">
                                            Total: {displayLines.length} itens
                                        </div>
                                    </div>
                                )}

                                {activeTab === "json" && (
                                    <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[300px]">
                                        {JSON.stringify({ order: displayOrder, lines: displayLines }, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* History Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Histórico de Processamentos
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            {showHistory ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <CardDescription>
                        Todos os PDFs processados com seus resultados
                    </CardDescription>
                </CardHeader>
                {showHistory && (
                    <CardContent>
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum processamento ainda
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 font-medium">ID</th>
                                            <th className="text-left py-3 font-medium">Arquivo</th>
                                            <th className="text-left py-3 font-medium">Pedido</th>
                                            <th className="text-left py-3 font-medium">Cliente</th>
                                            <th className="text-center py-3 font-medium">Itens</th>
                                            <th className="text-center py-3 font-medium">Status</th>
                                            <th className="text-left py-3 font-medium">Data</th>
                                            <th className="text-right py-3 font-medium">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item) => (
                                            <tr key={item.id} className="border-b hover:bg-muted/50">
                                                <td className="py-3 font-mono text-xs">{item.id.slice(0, 8)}...</td>
                                                <td className="py-3">{item.filename}</td>
                                                <td className="py-3 font-medium">{item.orderNumber || "-"}</td>
                                                <td className="py-3">{item.customerName || "-"}</td>
                                                <td className="py-3 text-center">{item.itemCount}</td>
                                                <td className="py-3 text-center">
                                                    {item.status === "success" ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="py-3 text-muted-foreground">
                                                    {formatDate(item.createdAt)}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleViewHistory(item.id)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                                                                <DialogHeader>
                                                                    <DialogTitle>Detalhes do Processamento</DialogTitle>
                                                                    <DialogDescription>
                                                                        ID: {item.id}
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                {historyDetail && selectedHistoryId === item.id && (
                                                                    <div className="space-y-4">
                                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                                            <div>
                                                                                <span className="text-muted-foreground">Arquivo:</span>
                                                                                <p className="font-medium">{historyDetail.filename}</p>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted-foreground">Tamanho:</span>
                                                                                <p className="font-medium">
                                                                                    {formatFileSize(historyDetail.fileSize)}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted-foreground">Tempo:</span>
                                                                                <p className="font-medium">
                                                                                    {historyDetail.processingTime}ms
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted-foreground">Warnings:</span>
                                                                                <p className="font-medium">{historyDetail.warningCount}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm text-muted-foreground">
                                                                                Resultado JSON:
                                                                            </span>
                                                                            <pre className="mt-1 text-xs bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
                                                                                {JSON.stringify(historyDetail.resultJson, null, 2)}
                                                                            </pre>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </DialogContent>
                                                        </Dialog>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteHistory(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
