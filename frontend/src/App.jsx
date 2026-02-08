import { useState, useCallback, useEffect } from 'react'
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
    const [selectedOrderIndex, setSelectedOrderIndex] = useState(0)
    const [view, setView] = useState('parser')

    const [configFile, setConfigFile] = useState(null)
    const [configText, setConfigText] = useState('')
    const [configPreview, setConfigPreview] = useState(null)
    const [configModelName, setConfigModelName] = useState('')
    const [configDisplayName, setConfigDisplayName] = useState('')
    const [configDetectionRules, setConfigDetectionRules] = useState('')
    const [configMappingConfig, setConfigMappingConfig] = useState('')
    const [configLoading, setConfigLoading] = useState(false)
    const [configError, setConfigError] = useState(null)
    const [configSaved, setConfigSaved] = useState(null)

    const [logs, setLogs] = useState([])
    const [logsLoading, setLogsLoading] = useState(false)
    const [logsError, setLogsError] = useState(null)
    const [selectedLog, setSelectedLog] = useState(null)
    const [documentDetail, setDocumentDetail] = useState(null)
    const [documentError, setDocumentError] = useState(null)
    const [logFilters, setLogFilters] = useState({
        status: '',
        model: '',
        company: '',
        filename: '',
        date_from: '',
        date_to: '',
    })

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

    const onDropConfigurator = useCallback((acceptedFiles) => {
        if (acceptedFiles.length > 0) {
            setConfigFile(acceptedFiles[0])
            setConfigText('')
            setConfigError(null)
        }
    }, [])

    const configDropzone = useDropzone({
        onDrop: onDropConfigurator,
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
            setSelectedOrderIndex(0) // Reset selection on new result
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

    const handleClear = () => {
        setFile(null)
        setText('')
        setResult(null)
        setError(null)
        setSelectedOrderIndex(0)
    }

    const handlePreviewConfigurator = async () => {
        if (!configFile && !configText.trim()) {
            setConfigError('Envie um PDF ou cole o texto do pedido')
            return
        }

        setConfigLoading(true)
        setConfigError(null)
        setConfigPreview(null)
        setConfigSaved(null)

        try {
            let response

            if (configFile) {
                const formData = new FormData()
                formData.append('file', configFile)
                response = await fetch(`${API_BASE}/models/preview`, {
                    method: 'POST',
                    body: formData,
                })
            } else {
                const formData = new FormData()
                formData.append('text', configText)
                response = await fetch(`${API_BASE}/models/preview`, {
                    method: 'POST',
                    body: formData,
                })
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Erro: ${response.status}`)
            }

            const data = await response.json()
            setConfigPreview(data)
            setConfigModelName(data.suggested_model_name || '')
            setConfigDisplayName(data.suggested_display_name || '')

            const suggestedRules = {
                keywords: data.suggested_display_name
                    ? data.suggested_display_name.toLowerCase().split(' ').filter(Boolean)
                    : [],
                customer_names: data.suggested_display_name ? [data.suggested_display_name] : [],
                customer_cnpjs: [],
                header_regex: [],
                required_fields: ['cnpj', 'pedido'],
            }

            const defaultMapping = {
                fields: [
                    { source: 'order.customer_order_number', target: 'order.order_number' },
                    { source: 'order.order_date', target: 'order.issue_date' },
                    { source: 'order.requested_delivery_date', target: 'order.delivery_date' },
                    { source: 'order.payment_terms_code', target: 'order.payment_terms' },
                ],
                item_fields: [
                    { source: 'lines[].item_reference_no', target: 'items[].sku' },
                    { source: 'lines[].description', target: 'items[].description' },
                    { source: 'lines[].quantity', target: 'items[].quantity' },
                    { source: 'lines[].unit_of_measure', target: 'items[].unit' },
                    { source: 'lines[].unit_price_excl_vat', target: 'items[].unit_price' },
                ],
            }

            setConfigDetectionRules(JSON.stringify(suggestedRules, null, 2))
            setConfigMappingConfig(JSON.stringify(defaultMapping, null, 2))
        } catch (err) {
            setConfigError(err.message || 'Erro ao gerar preview')
        } finally {
            setConfigLoading(false)
        }
    }

    const handleSaveModel = async () => {
        if (!configModelName) {
            setConfigError('Informe um nome para o modelo')
            return
        }
        try {
            const detectionRules = configDetectionRules ? JSON.parse(configDetectionRules) : {}
            const mappingConfig = configMappingConfig ? JSON.parse(configMappingConfig) : {}
            const payload = {
                name: configModelName,
                display_name: configDisplayName || configModelName,
                detection_rules: detectionRules,
                mapping_config: mappingConfig,
                examples: configFile ? [configFile.name] : undefined,
            }

            const response = await fetch(`${API_BASE}/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Erro: ${response.status}`)
            }

            const data = await response.json()
            setConfigSaved(data)
        } catch (err) {
            setConfigError(err.message || 'Erro ao salvar modelo')
        }
    }

    const fetchLogs = async () => {
        setLogsLoading(true)
        setLogsError(null)
        try {
            const params = new URLSearchParams()
            if (logFilters.status) params.append('status', logFilters.status)
            if (logFilters.model) params.append('model', logFilters.model)
            if (logFilters.company) params.append('company', logFilters.company)
            if (logFilters.filename) params.append('filename', logFilters.filename)
            if (logFilters.date_from) params.append('date_from', logFilters.date_from)
            if (logFilters.date_to) params.append('date_to', logFilters.date_to)
            const response = await fetch(`${API_BASE}/logs?${params.toString()}`)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Erro: ${response.status}`)
            }
            const data = await response.json()
            setLogs(data)
            setSelectedLog(data[0] || null)
        } catch (err) {
            setLogsError(err.message || 'Erro ao carregar logs')
        } finally {
            setLogsLoading(false)
        }
    }

    const fetchDocumentDetail = async (documentId) => {
        if (!documentId) return
        setDocumentError(null)
        try {
            const response = await fetch(`${API_BASE}/documents/${documentId}/parsed`)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Erro: ${response.status}`)
            }
            const data = await response.json()
            setDocumentDetail(data)
        } catch (err) {
            setDocumentError(err.message || 'Erro ao carregar documento')
        }
    }

    useEffect(() => {
        if (view === 'audit') {
            fetchLogs()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, logFilters])

    useEffect(() => {
        if (view === 'audit' && selectedLog?.document_id) {
            fetchDocumentDetail(selectedLog.document_id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLog])

    // Get current display data based on selection
    const displayOrder = result?.has_multiple_dates
        ? result.split_orders[selectedOrderIndex]?.order
        : result?.order
    const displayLines = result?.has_multiple_dates
        ? result.split_orders[selectedOrderIndex]?.lines
        : result?.lines

    return (
        <div className="app">
            <div className="container">
                <header className="header">
                    <img src="/logo.png" alt="Oligo Basics" className="header-logo" />
                    <h1>Parser de Pedidos</h1>
                    <p>Extração automática de dados para Business Central</p>
                </header>

                <div className="tab-switch">
                    <button
                        className={`btn ${view === 'parser' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setView('parser')}
                    >
                        Parser
                    </button>
                    <button
                        className={`btn ${view === 'configurator' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setView('configurator')}
                    >
                        Configurador
                    </button>
                    <button
                        className={`btn ${view === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setView('audit')}
                    >
                        Auditoria
                    </button>
                </div>

                <main className={`main-content ${view !== 'parser' ? 'single' : ''}`}>
                    {view === 'configurator' && (
                        <div className="card">
                            <div className="card-header">
                                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 1v22" />
                                    <path d="M5 5h14v14H5z" />
                                </svg>
                                <h2>Novo Modelo</h2>
                            </div>

                            <div
                                {...configDropzone.getRootProps()}
                                className={`dropzone ${configDropzone.isDragActive ? 'active' : ''}`}
                            >
                                <input {...configDropzone.getInputProps()} />
                                <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17,8 12,3 7,8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <p>Arraste o PDF para gerar preview</p>
                                <span className="hint">ou clique para selecionar</span>

                                {configFile && (
                                    <div className="file-info">
                                        📄 {configFile.name} ({(configFile.size / 1024).toFixed(1)} KB)
                                    </div>
                                )}
                            </div>

                            <div className="divider">ou</div>

                            <div className="textarea-container">
                                <label htmlFor="config-text">Cole o texto do pedido</label>
                                <textarea
                                    id="config-text"
                                    className="textarea"
                                    value={configText}
                                    onChange={(e) => {
                                        setConfigText(e.target.value)
                                        setConfigFile(null)
                                    }}
                                    placeholder="Cole o texto para gerar preview e sugerir modelo"
                                />
                            </div>

                            {configError && (
                                <div className="warning-item" style={{ marginTop: 'var(--space-md)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                                    <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    {configError}
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-block"
                                onClick={handlePreviewConfigurator}
                                disabled={configLoading}
                            >
                                {configLoading ? 'Gerando preview...' : 'Gerar Preview'}
                            </button>

                            {configPreview && (
                                <div className="config-section">
                                    <div className="info-box">
                                        <strong>Detecção:</strong> {configPreview.detected.model_name} (
                                        {(configPreview.detected.confidence * 100).toFixed(0)}%)
                                    </div>

                                    <div className="form-grid">
                                        <div className="form-field">
                                            <label>Nome do modelo</label>
                                            <input
                                                value={configModelName}
                                                onChange={(e) => setConfigModelName(e.target.value)}
                                                placeholder="lar, brf, custom-..."
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label>Nome exibido</label>
                                            <input
                                                value={configDisplayName}
                                                onChange={(e) => setConfigDisplayName(e.target.value)}
                                                placeholder="Razão social do cliente"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-field">
                                        <label>Regras de detecção (JSON)</label>
                                        <textarea
                                            className="textarea textarea-small"
                                            value={configDetectionRules}
                                            onChange={(e) => setConfigDetectionRules(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label>Mapeamento (JSON)</label>
                                        <textarea
                                            className="textarea textarea-small"
                                            value={configMappingConfig}
                                            onChange={(e) => setConfigMappingConfig(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label>Preview canônico</label>
                                        <pre className="json-preview">
                                            {JSON.stringify(configPreview.preview, null, 2)}
                                        </pre>
                                    </div>

                                    <button className="btn btn-secondary btn-block" onClick={handleSaveModel}>
                                        Salvar Modelo
                                    </button>

                                    {configSaved && (
                                        <div className="info-box success">
                                            Modelo salvo: {configSaved.name} ({configSaved.current_version.version})
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'audit' && (
                        <div className="card">
                            <div className="card-header">
                                <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12h6" />
                                    <path d="M9 16h6" />
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <path d="M9 4V2" />
                                    <path d="M15 4V2" />
                                </svg>
                                <h2>Auditoria</h2>
                            </div>

                            <div className="audit-filters">
                                <input
                                    placeholder="Modelo"
                                    value={logFilters.model}
                                    onChange={(e) => setLogFilters({ ...logFilters, model: e.target.value })}
                                />
                                <input
                                    placeholder="Empresa"
                                    value={logFilters.company}
                                    onChange={(e) => setLogFilters({ ...logFilters, company: e.target.value })}
                                />
                                <input
                                    placeholder="Arquivo"
                                    value={logFilters.filename}
                                    onChange={(e) => setLogFilters({ ...logFilters, filename: e.target.value })}
                                />
                                <select
                                    value={logFilters.status}
                                    onChange={(e) => setLogFilters({ ...logFilters, status: e.target.value })}
                                >
                                    <option value="">Status</option>
                                    <option value="success">success</option>
                                    <option value="partial">partial</option>
                                    <option value="failed">failed</option>
                                </select>
                                <input
                                    type="date"
                                    value={logFilters.date_from}
                                    onChange={(e) => setLogFilters({ ...logFilters, date_from: e.target.value })}
                                />
                                <input
                                    type="date"
                                    value={logFilters.date_to}
                                    onChange={(e) => setLogFilters({ ...logFilters, date_to: e.target.value })}
                                />
                                <button className="btn btn-secondary" onClick={fetchLogs} disabled={logsLoading}>
                                    Filtrar
                                </button>
                            </div>

                            {logsError && (
                                <div className="warning-item" style={{ marginTop: 'var(--space-md)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                                    {logsError}
                                </div>
                            )}

                            <div className="audit-grid">
                                <div className="audit-table">
                                    {logsLoading ? (
                                        <div className="empty-state">Carregando...</div>
                                    ) : logs.length === 0 ? (
                                        <div className="empty-state">Nenhum log encontrado.</div>
                                    ) : (
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Início</th>
                                                    <th>Modelo</th>
                                                    <th>Status</th>
                                                    <th>Empresa</th>
                                                    <th>Arquivo</th>
                                                    <th>Duração (ms)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.map((log) => (
                                                    <tr key={log.id} onClick={() => setSelectedLog(log)}>
                                                        <td>{log.started_at || '-'}</td>
                                                        <td>{log.model_name || '-'}</td>
                                                        <td className={`status ${log.status}`}>{log.status || '-'}</td>
                                                        <td>{log.company_name || '-'}</td>
                                                        <td>{log.filename || '-'}</td>
                                                        <td>{log.duration_ms ?? '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                <div className="audit-detail">
                                    {selectedLog ? (
                                        <>
                                            <div className="info-box">
                                                <strong>Status:</strong> {selectedLog.status || '-'} ·{' '}
                                                <strong>Modelo:</strong> {selectedLog.model_name || '-'} ·{' '}
                                                <strong>Confiança:</strong> {selectedLog.model_confidence ?? '-'}
                                            </div>

                                            {documentError && (
                                                <div className="warning-item" style={{ marginTop: 'var(--space-md)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                                                    {documentError}
                                                </div>
                                            )}

                                            {documentDetail ? (
                                                <>
                                                    <details className="json-collapsible" open>
                                                        <summary>JSON canônico</summary>
                                                        <pre className="json-preview">
                                                            {JSON.stringify(documentDetail, null, 2)}
                                                        </pre>
                                                    </details>
                                                    <details className="json-collapsible">
                                                        <summary>Warnings</summary>
                                                        <pre className="json-preview">
                                                            {JSON.stringify(documentDetail.parsing?.warnings || [], null, 2)}
                                                        </pre>
                                                    </details>
                                                    <details className="json-collapsible">
                                                        <summary>Missing fields</summary>
                                                        <pre className="json-preview">
                                                            {JSON.stringify(documentDetail.parsing?.missing_fields || [], null, 2)}
                                                        </pre>
                                                    </details>
                                                    <a
                                                        className="btn btn-secondary btn-block"
                                                        href={`${API_BASE}/documents/${selectedLog.document_id}/parsed/download`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Baixar JSON
                                                    </a>
                                                </>
                                            ) : (
                                                <div className="empty-state">Carregando documento...</div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="empty-state">Selecione um log para ver detalhes.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'parser' && (
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
                    )}

                    {view === 'parser' && (
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

                                {/* Order Selector for Multiple Delivery Dates */}
                                {result.has_multiple_dates && (
                                    <div className="order-selector">
                                        <div className="order-selector-header">
                                            <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            <span>Este pedido possui <strong>{result.split_orders.length}</strong> datas de entrega diferentes</span>
                                        </div>
                                        <div className="order-tabs-selector">
                                            {result.split_orders.map((splitOrder, idx) => (
                                                <button
                                                    key={idx}
                                                    className={`order-tab-btn ${selectedOrderIndex === idx ? 'active' : ''}`}
                                                    onClick={() => setSelectedOrderIndex(idx)}
                                                >
                                                    <span className="order-tab-date">{splitOrder.delivery_date || 'Sem data'}</span>
                                                    <span className="order-tab-count">{splitOrder.lines?.length || 0} {splitOrder.lines?.length === 1 ? 'item' : 'itens'}</span>
                                                </button>
                                            ))}
                                        </div>
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
                                        <OrderSection title="Detalhes do Pedido" data={displayOrder} />
                                        <SellToSection data={displayOrder?.sell_to} />
                                        <AddressSection title="Faturamento" data={displayOrder?.bill_to} />
                                        <AddressSection title="Entrega" data={displayOrder?.ship_to} />
                                        <LinesSection lines={displayLines} />
                                    </div>
                                )}

                                {/* JSON View */}
                                {activeTab === 'json' && (
                                    <div className="json-container">
                                        <pre dangerouslySetInnerHTML={{ __html: formatJSON({ order: displayOrder, lines: displayLines }) }} />
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
                    )}
                </main>
            </div >
        </div >
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
                            <th>Entrega</th>
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
                                <td className={!line.delivery_date ? 'null' : ''}>{line.delivery_date || 'null'}</td>
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
