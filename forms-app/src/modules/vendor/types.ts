// Types for Vendor Module

export interface VendorLoginInput {
    email: string;
    password: string;
}

export interface VendorItem {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    active: boolean;
    createdAt: Date;
    salesOrderCount?: number;
}

export interface VendorDetail extends VendorItem {
    organizationId: string;
}

export interface CreateVendorInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
}

export interface UpdateVendorInput {
    name?: string;
    email?: string;
    phone?: string;
    active?: boolean;
    password?: string;
}

// Sales Order Types

export interface SalesOrderItem {
    itemNumber: string;
    productCode: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: number;
    deliveryDate?: string;
}

export type SalesOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface SalesOrderListItem {
    id: string;
    customerOrderNumber: string;
    customerName: string;
    orderDate: Date;
    requestedDeliveryDate: Date;
    status: SalesOrderStatus;
    total: number | null;
    itemCount: number;
    createdAt: Date;
}

export interface SalesOrderDetail {
    id: string;
    status: SalesOrderStatus;

    // Seção 1: Dados do Pedido
    customerOrderNumber: string;
    orderDate: Date;
    requestedDeliveryDate: Date;
    promisedDeliveryDate: Date | null;
    invoiceDate: Date | null;

    // Seção 2: Cliente
    customerName: string;
    customerCnpj: string;
    customerIe: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    customerContact: string | null;

    // Seção 3: Endereço Cobrança
    billToStreet: string;
    billToNumber: string;
    billToComplement: string | null;
    billToDistrict: string;
    billToCity: string;
    billToState: string;
    billToZip: string;
    billToCountry: string;

    // Seção 4: Endereço Entrega
    sameAsBillTo: boolean;
    shipToStreet: string | null;
    shipToNumber: string | null;
    shipToComplement: string | null;
    shipToDistrict: string | null;
    shipToCity: string | null;
    shipToState: string | null;
    shipToZip: string | null;
    shipToCountry: string | null;

    // Seção 5: Itens
    items: SalesOrderItem[];

    // Seção 6: Condições de Pagamento
    paymentTermDays: number;
    paymentDaysOfMonth: string | null;
    paymentMethod: string | null;
    subtotal: number | null;
    discounts: number | null;
    freight: number | null;
    taxes: number | null;
    total: number | null;

    // Seção 7: Dados Financeiros
    currency: string;
    bankAccountCode: string | null;
    viaDeposit: boolean;

    // Seção 8: Frete e Entrega
    freightMode: string;
    carrier: string | null;
    deliveryInstructions: string | null;

    // Seção 9: Observações
    notes: string | null;

    vendorId: string;
    vendorName?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSalesOrderInput {
    // Seção 1
    customerOrderNumber: string;
    orderDate: string;
    requestedDeliveryDate: string;
    promisedDeliveryDate?: string;
    invoiceDate?: string;

    // Seção 2
    customerName: string;
    customerCnpj: string;
    customerIe?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerContact?: string;

    // Seção 3
    billToStreet: string;
    billToNumber: string;
    billToComplement?: string;
    billToDistrict: string;
    billToCity: string;
    billToState: string;
    billToZip: string;
    billToCountry?: string;

    // Seção 4
    sameAsBillTo: boolean;
    shipToStreet?: string;
    shipToNumber?: string;
    shipToComplement?: string;
    shipToDistrict?: string;
    shipToCity?: string;
    shipToState?: string;
    shipToZip?: string;
    shipToCountry?: string;

    // Seção 5
    items: SalesOrderItem[];

    // Seção 6
    paymentTermDays: number;
    paymentDaysOfMonth?: string;
    paymentMethod?: string;
    subtotal?: number;
    discounts?: number;
    freight?: number;
    taxes?: number;
    total?: number;

    // Seção 7
    currency?: string;
    bankAccountCode?: string;
    viaDeposit?: boolean;

    // Seção 8
    freightMode: string;
    carrier?: string;
    deliveryInstructions?: string;

    // Seção 9
    notes?: string;
}

// Brazilian States
export const BRAZILIAN_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

// Units of Measure
export const UNITS_OF_MEASURE = [
    { code: 'KG', label: 'Quilograma' },
    { code: 'G', label: 'Grama' },
    { code: 'TON', label: 'Tonelada' },
    { code: 'UN', label: 'Unidade' },
    { code: 'PC', label: 'Peça' },
    { code: 'L', label: 'Litro' },
    { code: 'ML', label: 'Mililitro' },
    { code: 'M', label: 'Metro' },
    { code: 'CX', label: 'Caixa' },
    { code: 'SC', label: 'Saco' },
    { code: 'FD', label: 'Fardo' },
] as const;

// Payment Methods
export const PAYMENT_METHODS = [
    { code: 'DEPOSIT', label: 'Depósito Bancário' },
    { code: 'BOLETO', label: 'Boleto' },
    { code: 'PIX', label: 'PIX' },
    { code: 'OTHER', label: 'Outro' },
] as const;

// Currencies
export const CURRENCIES = [
    { code: 'BRL', label: 'Real (R$)' },
    { code: 'USD', label: 'Dólar (US$)' },
    { code: 'EUR', label: 'Euro (€)' },
] as const;

// Freight Modes
export const FREIGHT_MODES = [
    { code: 'CIF', label: 'CIF (Frete por conta do vendedor)' },
    { code: 'FOB', label: 'FOB (Frete por conta do comprador)' },
] as const;
