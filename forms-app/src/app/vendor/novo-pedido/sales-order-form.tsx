'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSalesOrder, updateSalesOrder } from '@/modules/vendor/actions/sales-order-actions';
import {
    BRAZILIAN_STATES,
    UNITS_OF_MEASURE,
    PAYMENT_METHODS,
    CURRENCIES,
    FREIGHT_MODES,
    type SalesOrderItem,
    type CreateSalesOrderInput,
    type SalesOrderDetail
} from '@/modules/vendor/types';
import { format } from 'date-fns';

const emptyItem: SalesOrderItem = {
    itemNumber: '',
    productCode: '',
    description: '',
    quantity: 0,
    unitOfMeasure: 'KG',
    unitPrice: 0,
    deliveryDate: '',
};

interface SalesOrderFormProps {
    initialData?: SalesOrderDetail | null;
}

export function SalesOrderForm({ initialData }: SalesOrderFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [sameAsBillTo, setSameAsBillTo] = useState(initialData ? initialData.sameAsBillTo : true);
    const [items, setItems] = useState<SalesOrderItem[]>(
        initialData?.items && initialData.items.length > 0
            ? initialData.items.map(item => ({
                ...item,
                deliveryDate: item.deliveryDate ? format(new Date(item.deliveryDate), 'yyyy-MM-dd') : ''
            }))
            : [{ ...emptyItem }]
    );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const formData = new FormData(e.currentTarget);

            // Validate items
            const validItems = items.filter(
                (item) => item.itemNumber && item.productCode && item.description && item.quantity > 0 && item.unitPrice > 0
            );

            if (validItems.length === 0) {
                throw new Error('Adicione ao menos 1 item completo ao pedido');
            }

            const input: CreateSalesOrderInput = {
                // Seção 1
                customerOrderNumber: formData.get('customerOrderNumber') as string,
                orderDate: formData.get('orderDate') as string,
                requestedDeliveryDate: formData.get('requestedDeliveryDate') as string,
                promisedDeliveryDate: formData.get('promisedDeliveryDate') as string || undefined,
                invoiceDate: formData.get('invoiceDate') as string || undefined,

                // Seção 2
                customerName: formData.get('customerName') as string,
                customerCnpj: formData.get('customerCnpj') as string,
                customerIe: formData.get('customerIe') as string || undefined,
                customerPhone: formData.get('customerPhone') as string || undefined,
                customerEmail: formData.get('customerEmail') as string || undefined,
                customerContact: formData.get('customerContact') as string || undefined,

                // Seção 3
                billToStreet: formData.get('billToStreet') as string,
                billToNumber: formData.get('billToNumber') as string,
                billToComplement: formData.get('billToComplement') as string || undefined,
                billToDistrict: formData.get('billToDistrict') as string,
                billToCity: formData.get('billToCity') as string,
                billToState: formData.get('billToState') as string,
                billToZip: formData.get('billToZip') as string,
                billToCountry: formData.get('billToCountry') as string || 'Brasil',

                // Seção 4
                sameAsBillTo,
                shipToStreet: sameAsBillTo ? undefined : formData.get('shipToStreet') as string,
                shipToNumber: sameAsBillTo ? undefined : formData.get('shipToNumber') as string,
                shipToComplement: sameAsBillTo ? undefined : formData.get('shipToComplement') as string || undefined,
                shipToDistrict: sameAsBillTo ? undefined : formData.get('shipToDistrict') as string,
                shipToCity: sameAsBillTo ? undefined : formData.get('shipToCity') as string,
                shipToState: sameAsBillTo ? undefined : formData.get('shipToState') as string,
                shipToZip: sameAsBillTo ? undefined : formData.get('shipToZip') as string,
                shipToCountry: sameAsBillTo ? undefined : formData.get('shipToCountry') as string,

                // Seção 5
                items: validItems,

                // Seção 6
                paymentTermDays: parseInt(formData.get('paymentTermDays') as string) || 30,
                paymentDaysOfMonth: formData.get('paymentDaysOfMonth') as string || undefined,
                paymentMethod: formData.get('paymentMethod') as string || undefined,
                subtotal: parseFloat(formData.get('subtotal') as string) || undefined,
                discounts: parseFloat(formData.get('discounts') as string) || undefined,
                freight: parseFloat(formData.get('freight') as string) || undefined,
                taxes: parseFloat(formData.get('taxes') as string) || undefined,
                total: parseFloat(formData.get('total') as string) || undefined,

                // Seção 7
                currency: formData.get('currency') as string || 'BRL',
                bankAccountCode: formData.get('bankAccountCode') as string || undefined,
                viaDeposit: formData.get('viaDeposit') === 'on',

                // Seção 8
                freightMode: formData.get('freightMode') as string,
                carrier: formData.get('carrier') as string || undefined,
                deliveryInstructions: formData.get('deliveryInstructions') as string || undefined,

                // Seção 9
                notes: formData.get('notes') as string || undefined,
            };

            if (initialData?.id) {
                await updateSalesOrder(initialData.id, input);
            } else {
                await createSalesOrder(input);
            }

            router.push('/vendor');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar pedido');
            // Scroll to top to show error
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    }

    function addItem() {
        setItems([...items, { ...emptyItem }]);
    }

    function removeItem(index: number) {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    }

    function updateItem(index: number, field: keyof SalesOrderItem, value: string | number) {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    }

    const formatDateForInput = (date: Date | string | undefined | null) => {
        if (!date) return '';
        return format(new Date(date), 'yyyy-MM-dd');
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* SEÇÃO 1: DADOS DO PEDIDO */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
                    Dados do Pedido
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nº do Pedido do Cliente <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="customerOrderNumber"
                            required
                            defaultValue={initialData?.customerOrderNumber}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data do Pedido <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            name="orderDate"
                            required
                            defaultValue={formatDateForInput(initialData?.orderDate) || today}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data de Entrega Solicitada <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            name="requestedDeliveryDate"
                            required
                            defaultValue={formatDateForInput(initialData?.requestedDeliveryDate)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data de Entrega Prometida
                        </label>
                        <input
                            type="date"
                            name="promisedDeliveryDate"
                            defaultValue={formatDateForInput(initialData?.promisedDeliveryDate)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data de Faturamento
                        </label>
                        <input
                            type="date"
                            name="invoiceDate"
                            defaultValue={formatDateForInput(initialData?.invoiceDate)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </section>

            {/* SEÇÃO 2: DADOS DO CLIENTE */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
                    Dados do Cliente (Sell-To)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Razão Social <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="customerName"
                            required
                            defaultValue={initialData?.customerName}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            CNPJ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="customerCnpj"
                            required
                            defaultValue={initialData?.customerCnpj}
                            placeholder="00.000.000/0000-00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Inscrição Estadual (IE)
                        </label>
                        <input
                            type="text"
                            name="customerIe"
                            defaultValue={initialData?.customerIe || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Telefone
                        </label>
                        <input
                            type="tel"
                            name="customerPhone"
                            defaultValue={initialData?.customerPhone || ''}
                            placeholder="(00) 00000-0000"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            E-mail
                        </label>
                        <input
                            type="email"
                            name="customerEmail"
                            defaultValue={initialData?.customerEmail || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contato (Nome)
                        </label>
                        <input
                            type="text"
                            name="customerContact"
                            defaultValue={initialData?.customerContact || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </section>

            {/* SEÇÃO 3: ENDEREÇO DE COBRANÇA */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">3</span>
                    Endereço de Cobrança (Bill-To)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Logradouro <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="billToStreet"
                            required
                            defaultValue={initialData?.billToStreet}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Número <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="billToNumber"
                            required
                            defaultValue={initialData?.billToNumber}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Complemento
                        </label>
                        <input
                            type="text"
                            name="billToComplement"
                            defaultValue={initialData?.billToComplement || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Bairro <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="billToDistrict"
                            required
                            defaultValue={initialData?.billToDistrict}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cidade <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="billToCity"
                            required
                            defaultValue={initialData?.billToCity}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Estado (UF) <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="billToState"
                            required
                            defaultValue={initialData?.billToState}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {BRAZILIAN_STATES.map((state) => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            CEP <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="billToZip"
                            required
                            defaultValue={initialData?.billToZip}
                            placeholder="00000-000"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </section>

            {/* SEÇÃO 4: ENDEREÇO DE ENTREGA */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">4</span>
                    Endereço de Entrega (Ship-To)
                </h2>
                <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={sameAsBillTo}
                            onChange={(e) => setSameAsBillTo(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Mesmo endereço de cobrança</span>
                    </label>
                </div>
                {!sameAsBillTo && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                            <input
                                type="text"
                                name="shipToStreet"
                                defaultValue={initialData?.shipToStreet || ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                            <input
                                type="text"
                                name="shipToNumber"
                                defaultValue={initialData?.shipToNumber || ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                            <input
                                type="text"
                                name="shipToComplement"
                                defaultValue={initialData?.shipToComplement || ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                            <input
                                type="text"
                                name="shipToDistrict"
                                defaultValue={initialData?.shipToDistrict || ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                            <input
                                type="text"
                                name="shipToCity"
                                defaultValue={initialData?.shipToCity || ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estado (UF)</label>
                            <select
                                name="shipToState"
                                defaultValue={initialData?.shipToState || ''}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Selecione...</option>
                                {BRAZILIAN_STATES.map((state) => (
                                    <option key={state} value={state}>{state}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                            <input
                                type="text"
                                name="shipToZip"
                                defaultValue={initialData?.shipToZip || ''}
                                placeholder="00000-000"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* SEÇÃO 5: ITENS DO PEDIDO */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">5</span>
                        Itens do Pedido
                    </h2>
                    <button
                        type="button"
                        onClick={addItem}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Adicionar Item
                    </button>
                </div>
                <div className="space-y-4">
                    {items.map((item, index) => (
                        <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-600">Item {index + 1}</span>
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        Remover
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Nº Item <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={item.itemNumber}
                                        onChange={(e) => updateItem(index, 'itemNumber', e.target.value)}
                                        placeholder="0010"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Código <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={item.productCode}
                                        onChange={(e) => updateItem(index, 'productCode', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Descrição <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Quantidade <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={item.quantity || ''}
                                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Unidade <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={item.unitOfMeasure}
                                        onChange={(e) => updateItem(index, 'unitOfMeasure', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        {UNITS_OF_MEASURE.map((unit) => (
                                            <option key={unit.code} value={unit.code}>{unit.code}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Preço Unit. <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={item.unitPrice || ''}
                                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Data Entrega</label>
                                    <input
                                        type="date"
                                        value={item.deliveryDate || ''}
                                        onChange={(e) => updateItem(index, 'deliveryDate', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SEÇÃO 6: CONDIÇÕES DE PAGAMENTO */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">6</span>
                    Condições de Pagamento
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prazo de Pagamento (dias) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="paymentTermDays"
                            required
                            defaultValue={initialData?.paymentTermDays || 30}
                            placeholder="30, 60, 90..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dias de Pagamento do Mês
                        </label>
                        <input
                            type="text"
                            name="paymentDaysOfMonth"
                            defaultValue={initialData?.paymentDaysOfMonth || ''}
                            placeholder="05,20"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Método de Pagamento
                        </label>
                        <select
                            name="paymentMethod"
                            defaultValue={initialData?.paymentMethod || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {PAYMENT_METHODS.map((method) => (
                                <option key={method.code} value={method.code}>{method.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal (R$)</label>
                        <input
                            type="number"
                            name="subtotal"
                            step="0.01"
                            defaultValue={initialData?.subtotal || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descontos (R$)</label>
                        <input
                            type="number"
                            name="discounts"
                            step="0.01"
                            defaultValue={initialData?.discounts || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frete (R$)</label>
                        <input
                            type="number"
                            name="freight"
                            step="0.01"
                            defaultValue={initialData?.freight || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Impostos (R$)</label>
                        <input
                            type="number"
                            name="taxes"
                            step="0.01"
                            defaultValue={initialData?.taxes || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Geral (R$)</label>
                        <input
                            type="number"
                            name="total"
                            step="0.01"
                            defaultValue={initialData?.total || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </section>

            {/* SEÇÃO 7: DADOS FINANCEIROS */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">7</span>
                    Dados Financeiros
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Moeda <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="currency"
                            defaultValue={initialData?.currency || 'BRL'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {CURRENCIES.map((currency) => (
                                <option key={currency.code} value={currency.code}>{currency.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Código da Conta Bancária
                        </label>
                        <input
                            type="text"
                            name="bankAccountCode"
                            defaultValue={initialData?.bankAccountCode || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-2">
                            <input
                                type="checkbox"
                                name="viaDeposit"
                                defaultChecked={initialData?.viaDeposit || false}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Via Depósito Bancário</span>
                        </label>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 8: FRETE E ENTREGA */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">8</span>
                    Frete e Entrega
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Modalidade de Frete <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="freightMode"
                            required
                            defaultValue={initialData?.freightMode}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {FREIGHT_MODES.map((mode) => (
                                <option key={mode.code} value={mode.code}>{mode.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transportadora
                        </label>
                        <input
                            type="text"
                            name="carrier"
                            defaultValue={initialData?.carrier || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Instruções Especiais de Entrega
                        </label>
                        <input
                            type="text"
                            name="deliveryInstructions"
                            defaultValue={initialData?.deliveryInstructions || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </section>

            {/* SEÇÃO 9: OBSERVAÇÕES */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">9</span>
                    Observações Gerais
                </h2>
                <textarea
                    name="notes"
                    rows={4}
                    defaultValue={initialData?.notes || ''}
                    placeholder="Observações adicionais sobre o pedido..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </section>

            {/* SUBMIT */}
            <div className="flex items-center justify-end gap-4 pb-8">
                <a
                    href="/vendor"
                    className="px-6 py-3 text-gray-700 hover:text-gray-900"
                >
                    Cancelar
                </a>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Salvando...
                        </>
                    ) : (
                        'Salvar Pedido'
                    )}
                </button>
            </div>
        </form>
    );
}
