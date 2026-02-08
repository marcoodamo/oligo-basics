export interface ParserProcessingItem {
    id: string;
    filename: string;
    fileSize: number;
    status: string;
    documentType: string | null;
    orderNumber: string | null;
    customerName: string | null;
    itemCount: number;
    warningCount: number;
    processingTime: number | null;
    createdAt: Date;
}

export interface ParserProcessingDetail extends ParserProcessingItem {
    resultJson: any;
    warnings: string[];
    updatedAt: Date;
}
