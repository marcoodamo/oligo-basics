import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

// API base URL - uses proxy in dev, direct in production
const API_BASE = import.meta.env.PROD ? 'http://localhost:8000' : '/api'

function App() {
    const [file, setFile] = useState(null)
    const [text, setText] = useState('')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('sections')

    // Dropzone configuration
    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0])
            setText('') // Clear text when file is uploaded
            setError(null)
        }
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false,
    })

    // Process order
    const handleProcess = async () => {
        if (!file && !text.trim()) {
            setError('Por favor, envie um PDF ou cole o texto do pedido')
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            let response

            if (file) {
                // Upload PDF
                const formData = new FormData()
                formData.append('file', file)

                response = await fetch(`${API_BASE}/parse`, {
                    method: 'POST',
                    body: formData,
                })
            } else {
                // Send text
                response = await fetch(`${API_BASE}/parse/text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                })
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Erro: ${response.status}`)
            }

            const data = await response.json()
            setResult(data)
        } catch (err) {
            setError(err.message || 'Ocorreu um erro ao processar')
        } finally {
            setLoading(false)
        }
    }

    // Download JSON
    const handleDownload = () => {
        if (!result) return

        const jsonData = {
            order: result.order,
            lines: result.lines,
        }

        // Generate filename with order number if available
        const orderNum = result.order?.customer_order_number || 'pedido'
        const filename = `${orderNum}_extraido.json`

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // Download and start new
    const handleDownloadAndNew = () => {
        handleDownload()
        // Small delay to ensure download started
        setTimeout(() => {
            handleClear()
        }, 100)
    }

    // Clear all
    const handleClear = () => {
        setFile(null)
        setText('')
        setResult(null)
        setError(null)
    }

    return (
        <div className="app">
            <div className="container">
                <header className="header">
                    <img src="/logo.png" alt="Oligo Basics" className="header-logo" />
                    <h1>Parser de Pedidos</h1>
                    <p>Extração automática de dados para Business Central</p>
                </header>

                <main className="main-content">
                    {/* Input Panel */}
                    <div className="card">
                        <div className="card-header">
                            <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14,2 14,8 20,8" />
                            </svg>
                            <h2>Enviar Pedido</h2>
                        </div>

                        {/* Dropzone */}
                        <div
                            {...getRootProps()}
                            className={`dropzone ${isDragActive ? 'active' : ''}`}
                        >
                            <input {...getInputProps()} />
                            <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17,8 12,3 7,8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <p>Arraste e solte seu PDF aqui</p>
                            <span className="hint">ou clique para selecionar</span>

                            {file && (
                                <div className="file-info">
                                    📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                </div>
                            )}
                        </div>

                        <div className="divider">ou</div>

                        {/* Text Area */}
                        <div className="textarea-container">
                            <label htmlFor="order-text">Cole o texto do pedido</label>
                            <textarea
                                id="order-text"
                                className="textarea"
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value)
                                    setFile(null) // Clear file when typing
                                }}
                                placeholder="Cole aqui o conteúdo do pedido (corpo de e-mail, texto extraído, etc.)"
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="warning-item" style={{ marginTop: 'var(--space-md)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                                <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Actions */}
                        <button
                            className="btn btn-primary btn-block"
                            onClick={handleProcess}
                            disabled={loading || (!file && !text.trim())}
                        >
                            {loading ? (
                                <span className="loading">
                                    <span className="spinner"></span>
                                    Processando...
                                </span>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
                                    </svg>
                                    Processar Pedido
                                </>
                            )}
                        </button>

                        {(file || text || result) && (
                            <button
                                className="btn btn-secondary btn-block"
                                onClick={handleClear}
                                style={{ marginTop: 'var(--space-sm)' }}
                            >
                                Limpar Tudo
                            </button>
                        )}
                    </div>

                    {/* Results Panel */}
                    <div className="card results-panel">
                        <div className="card-header">
                            <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <h2>Dados Extraídos</h2>
                            {result && (
                                <span className="doc-type-badge" style={{ marginLeft: 'auto' }}>
                                    {result.document_type === 'purchase_order' ? 'Pedido de Compra' :
                                        result.document_type === 'email' ? 'E-mail' :
                                            result.document_type === 'quote' ? 'Cotação' :
                                                result.document_type === 'invoice' ? 'Nota Fiscal' : 'Documento'}
                                </span>
                            )}
                        </div>

                        {!result ? (
                            <div className="empty-state">
                                <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <line x1="3" y1="9" x2="21" y2="9" />
                                    <line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                                <p>Envie um PDF ou cole o texto para ver os dados extraídos</p>
                            </div>
                        ) : (
                            <div className="fade-in">
                                {/* Warnings */}
                                {result.warnings && result.warnings.length > 0 && (
                                    <div className="warnings">
                                        {result.warnings.map((warning, i) => (
                                            <div key={i} className="warning-item">
                                                <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                    <line x1="12" y1="9" x2="12" y2="13" />
                                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                                </svg>
                                                {warning}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Tabs */}
                                <div className="tabs">
                                    <button
                                        className={`tab ${activeTab === 'sections' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('sections')}
                                    >
                                        Por Seção
                                    </button>
                                    <button
                                        className={`tab ${activeTab === 'json' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('json')}
                                    >
                                        JSON
                                    </button>
                                </div>

                                {/* Sections View */}
                                {activeTab === 'sections' && (
                                    <div>
                                        <OrderSection title="Detalhes do Pedido" data={result.order} />
                                        <SellToSection data={result.order?.sell_to} />
                                        <AddressSection title="Faturamento" data={result.order?.bill_to} />
                                        <AddressSection title="Entrega" data={result.order?.ship_to} />
                                        <LinesSection lines={result.lines} />
                                    </div>
                                )}

                                {/* JSON View */}
                                {activeTab === 'json' && (
                                    <div className="json-container">
                                        <pre dangerouslySetInnerHTML={{ __html: formatJSON({ order: result.order, lines: result.lines }) }} />
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="actions">
                                    <button className="btn btn-primary" onClick={handleDownload}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7,10 12,15 17,10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Baixar JSON
                                    </button>
                                    <button className="btn btn-secondary" onClick={handleDownloadAndNew}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7,10 12,15 17,10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Baixar e Próximo
                                    </button>
                                    <button className="btn btn-new" onClick={handleClear}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M23 4v6h-6" />
                                            <path d="M1 20v-6h6" />
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                                            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                                        </svg>
                                        Novo Pedido
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}

// Order Section Component
function OrderSection({ title, data }) {
    if (!data) return null

    const fields = [
        { key: 'customer_order_number', label: 'Nº do Pedido' },
        { key: 'order_date', label: 'Data do Pedido' },
        { key: 'requested_delivery_date', label: 'Data Entrega Requerida' },
        { key: 'promised_delivery_date', label: 'Data Entrega Prometida' },
        { key: 'billing_date', label: 'Data Faturamento' },
        { key: 'currency_code', label: 'Moeda' },
        { key: 'payment_terms_code', label: 'Cód. Termos Pagamento' },
        { key: 'payment_method_code', label: 'Forma de Pagamento' },
        { key: 'shipping_method_code', label: 'Método de Envio' },
    ]

    return (
        <div className="section">
            <h3 className="section-header">{title}</h3>
            <div className="fields-grid">
                {fields.map(({ key, label }) => (
                    <Field key={key} label={label} value={data[key]} />
                ))}
            </div>
            {data.notes && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                    <Field label="Observações" value={data.notes} />
                </div>
            )}
        </div>
    )
}

// Sell To Section Component
function SellToSection({ data }) {
    if (!data) return null

    const fields = [
        { key: 'name', label: 'Razão Social' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'ie', label: 'Inscrição Estadual' },
        { key: 'phone', label: 'Telefone' },
        { key: 'email', label: 'E-mail' },
        { key: 'contact', label: 'Contato' },
    ]

    return (
        <div className="section">
            <h3 className="section-header">Cliente (Comprador)</h3>
            <div className="fields-grid">
                {fields.map(({ key, label }) => (
                    <Field key={key} label={label} value={data[key]} />
                ))}
            </div>
        </div>
    )
}

// Address Section Component
function AddressSection({ title, data }) {
    if (!data) return null

    const fields = [
        { key: 'address', label: 'Endereço' },
        { key: 'number', label: 'Número' },
        { key: 'complement', label: 'Complemento' },
        { key: 'district', label: 'Bairro' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'UF' },
        { key: 'zip', label: 'CEP' },
        { key: 'country', label: 'País' },
    ]

    return (
        <div className="section">
            <h3 className="section-header">{title}</h3>
            <div className="fields-grid">
                {fields.map(({ key, label }) => (
                    <Field key={key} label={label} value={data[key]} />
                ))}
            </div>
        </div>
    )
}

// Lines Section Component
function LinesSection({ lines }) {
    if (!lines || lines.length === 0) {
        return (
            <div className="section">
                <h3 className="section-header">Itens do Pedido</h3>
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhum item detectado
                </p>
            </div>
        )
    }

    return (
        <div className="section">
            <h3 className="section-header">Itens do Pedido ({lines.length} {lines.length === 1 ? 'item' : 'itens'})</h3>
            <div style={{ overflowX: 'auto' }}>
                <table className="lines-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Referência</th>
                            <th>Descrição</th>
                            <th>Qtd</th>
                            <th>Unid</th>
                            <th>Preço Unit.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line, i) => (
                            <tr key={i}>
                                <td>{line.customer_order_item_no || i + 1}</td>
                                <td className={!line.item_reference_no ? 'null' : ''}>{line.item_reference_no || 'null'}</td>
                                <td className={!line.description ? 'null' : ''}>{line.description || 'null'}</td>
                                <td className={line.quantity === null ? 'null' : ''}>{line.quantity ?? 'null'}</td>
                                <td className={!line.unit_of_measure ? 'null' : ''}>{line.unit_of_measure || 'null'}</td>
                                <td className={line.unit_price_excl_vat === null ? 'null' : ''}>
                                    {line.unit_price_excl_vat !== null ? formatCurrency(line.unit_price_excl_vat) : 'null'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// Field Component
function Field({ label, value }) {
    return (
        <div className="field">
            <div className="field-label">{label}</div>
            <div className={`field-value ${value === null || value === undefined ? 'null' : ''}`}>
                {value === null || value === undefined ? 'null' : String(value)}
            </div>
        </div>
    )
}

// Utility: Format currency
function formatCurrency(value) {
    if (typeof value !== 'number') return value
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Utility: Format JSON with syntax highlighting
function formatJSON(obj) {
    const json = JSON.stringify(obj, null, 2)
    return json
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
        .replace(/: null/g, ': <span class="json-null">null</span>')
}

export default App
