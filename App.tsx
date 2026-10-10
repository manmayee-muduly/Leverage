import { useRef, useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import './App.css'

type Company = {
  name: string
  sector: string
  region: string
  size: string
  stage: 'Production' | 'Pilot' | 'Exploring'
  autonomy: number
  efficiency: number
  useCase: string
  measured: boolean
}

const companies: Company[] = [
  { name: 'Northline Freight', sector: 'Logistics', region: 'North America', size: 'Large', stage: 'Production', autonomy: 78, efficiency: 31, useCase: 'Route exception handling', measured: true },
  { name: 'Juniper Foods', sector: 'Manufacturing', region: 'Europe', size: 'Mid-market', stage: 'Production', autonomy: 66, efficiency: 24, useCase: 'Quality assurance', measured: true },
  { name: 'Meridian Credit', sector: 'Financial services', region: 'North America', size: 'Large', stage: 'Production', autonomy: 58, efficiency: 19, useCase: 'Regulatory evidence review', measured: false },
  { name: 'Kite & Loom', sector: 'Retail', region: 'Asia Pacific', size: 'SME', stage: 'Pilot', autonomy: 42, efficiency: 15, useCase: 'Demand forecasting', measured: false },
  { name: 'Aster Medical', sector: 'Healthcare', region: 'Europe', size: 'Mid-market', stage: 'Pilot', autonomy: 35, efficiency: 12, useCase: 'Claims triage', measured: false },
  { name: 'Cedar Components', sector: 'Manufacturing', region: 'North America', size: 'SME', stage: 'Exploring', autonomy: 18, efficiency: 8, useCase: 'Supplier onboarding', measured: false },
  { name: 'Blue Current', sector: 'Energy', region: 'Asia Pacific', size: 'Large', stage: 'Production', autonomy: 73, efficiency: 28, useCase: 'Grid maintenance planning', measured: false },
  { name: 'Pollen Market', sector: 'Retail', region: 'Europe', size: 'Mid-market', stage: 'Pilot', autonomy: 39, efficiency: 17, useCase: 'Customer operations', measured: false },
  { name: 'Atlas Clearing', sector: 'Financial services', region: 'Asia Pacific', size: 'Large', stage: 'Pilot', autonomy: 47, efficiency: 21, useCase: 'Transaction monitoring', measured: false },
  { name: 'Kindred Care', sector: 'Healthcare', region: 'North America', size: 'SME', stage: 'Exploring', autonomy: 14, efficiency: 6, useCase: 'Care coordination', measured: false },
  { name: 'Westward Cargo', sector: 'Logistics', region: 'Europe', size: 'Mid-market', stage: 'Production', autonomy: 61, efficiency: 26, useCase: 'Customs documentation', measured: false },
  { name: 'Solace Energy', sector: 'Energy', region: 'North America', size: 'Mid-market', stage: 'Pilot', autonomy: 44, efficiency: 18, useCase: 'Compliance reporting', measured: false },
]

const trend = [
  { month: 'May', value: 32 },
  { month: 'Jun', value: 37 },
  { month: 'Jul', value: 39 },
  { month: 'Aug', value: 46 },
  { month: 'Sep', value: 53 },
  { month: 'Oct', value: 61 },
]

const demoSteps = [
  { title: 'Capture manual totals', detail: 'Invoice and packing-list totals are entered manually; no files are parsed.' },
  { title: 'Reconcile declared quantities', detail: 'Invoice: 2,400 units. Packing list: 2,380 units. Variance: 20.' },
  { title: 'Check integration boundaries', detail: 'No customs, sanctions, or external trade-compliance service is connected.' },
  { title: 'Prepare recommendation', detail: 'Hold for human review until the quantity variance is resolved.' },
]

const storageKey = 'fieldwork-enterprise-records-v1'
const requiredHeaders = ['enterprise', 'sector', 'region', 'size', 'stage', 'autonomy_score', 'efficiency_gain_pct', 'primary_use_case', 'measured_outcome']
const templateHeaders = ['enterprise', 'sector', 'region', 'size', 'stage', 'autonomy_score', 'efficiency_gain_pct', 'primary_use_case', 'measured_outcome']
const maxUploadBytes = 2 * 1024 * 1024
const maxRows = 5000
type DemoStatus = 'ready' | 'running' | 'review' | 'ready-for-confirmation' | 'correction-requested' | 'review-confirmed'
type AuditEvent = { timestamp: string; actor: string; action: string; detail: string }
type ShipmentLine = { id: string; sku: string; description: string; invoiceQuantity: string; packingQuantity: string }
const initialShipmentLines: ShipmentLine[] = [
  { id: 'line-1', sku: 'SKU-041', description: 'Connector assemblies', invoiceQuantity: '1200', packingQuantity: '1200' },
  { id: 'line-2', sku: 'SKU-118', description: 'Control modules', invoiceQuantity: '800', packingQuantity: '780' },
  { id: 'line-3', sku: 'SKU-203', description: 'Power units', invoiceQuantity: '400', packingQuantity: '400' },
]
type ShipmentAudit = {
  runId: string
  startedAt: string
  completedAt: string
  mode: 'local-rule-simulation'
  invoiceQuantity: number
  packingQuantity: number
  variance: number
  mismatchedLineCount: number
  lineItems: { sku: string; description: string; invoiceQuantity: number; packingQuantity: number; variance: number }[]
  systemDecision: string
  reviewerDecision: string
  events: AuditEvent[]
}

function isCompany(value: unknown): value is Company {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string' && typeof record.sector === 'string' &&
    typeof record.region === 'string' && typeof record.size === 'string' &&
    typeof record.useCase === 'string' && typeof record.measured === 'boolean' &&
    ['Production', 'Pilot', 'Exploring'].includes(String(record.stage)) &&
    typeof record.autonomy === 'number' && record.autonomy >= 0 && record.autonomy <= 100 &&
    typeof record.efficiency === 'number' && record.efficiency >= 0 && record.efficiency <= 100
}

function loadInitialDataset() {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isCompany)) {
        return { companies: parsed, imported: true }
      }
    }
  } catch {
    return { companies, imported: false }
  }
  return { companies, imported: false }
}

function csvCell(value: string) {
  const safeValue = /^[\s]*[=+@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replaceAll('"', '""')}"`
}

function timestampNow() {
  return new Date().toISOString()
}

function App() {
  const [dataset, setDataset] = useState(loadInitialDataset)
  const companies = dataset.companies
  const [sector, setSector] = useState('All sectors')
  const [region, setRegion] = useState('All regions')
  const [size, setSize] = useState('All sizes')
  const [activeNav, setActiveNav] = useState('Overview')
  const [importMessage, setImportMessage] = useState('')
  const [importError, setImportError] = useState(false)
  const [demoStatus, setDemoStatus] = useState<DemoStatus>('ready')
  const [completedDemoSteps, setCompletedDemoSteps] = useState(0)
  const [shipmentLines, setShipmentLines] = useState(initialShipmentLines)
  const [shipmentAudit, setShipmentAudit] = useState<ShipmentAudit | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const sectors = ['All sectors', ...new Set(companies.map((company) => company.sector))]
  const regions = ['All regions', ...new Set(companies.map((company) => company.region))]
  const sizes = ['All sizes', ...new Set(companies.map((company) => company.size))]
  const filtered = companies.filter((company) =>
    (sector === 'All sectors' || company.sector === sector) &&
    (region === 'All regions' || company.region === region) &&
    (size === 'All sizes' || company.size === size),
  )
  const production = filtered.filter((company) => company.stage === 'Production')
  const pilots = filtered.filter((company) => company.stage === 'Pilot')
  const productionRate = filtered.length ? Math.round((production.length / filtered.length) * 100) : 0
  const avgAutonomy = filtered.length ? Math.round(filtered.reduce((sum, company) => sum + company.autonomy, 0) / filtered.length) : 0
  const avgEfficiency = filtered.length ? Math.round(filtered.reduce((sum, company) => sum + company.efficiency, 0) / filtered.length) : 0
  const measuredCount = filtered.filter((company) => company.measured).length
  const parsedShipmentLines = shipmentLines.map((line) => ({
    ...line,
    invoiceCount: Number(line.invoiceQuantity),
    packingCount: Number(line.packingQuantity),
  }))
  const quantityInputsValid = shipmentLines.length > 0 && parsedShipmentLines.every((line) =>
    line.invoiceQuantity.trim() !== '' && line.packingQuantity.trim() !== '' &&
    [line.invoiceCount, line.packingCount].every((quantity) => Number.isInteger(quantity) && quantity >= 0 && quantity <= 100000),
  )
  const invoiceCount = quantityInputsValid ? parsedShipmentLines.reduce((total, line) => total + line.invoiceCount, 0) : 0
  const packingCount = quantityInputsValid ? parsedShipmentLines.reduce((total, line) => total + line.packingCount, 0) : 0
  const mismatchedLineCount = quantityInputsValid ? parsedShipmentLines.filter((line) => line.invoiceCount !== line.packingCount).length : 0
  const quantityVariance = quantityInputsValid ? parsedShipmentLines.reduce((total, line) => total + Math.abs(line.invoiceCount - line.packingCount), 0) : 0
  const quantityMismatch = mismatchedLineCount > 0

  function showImportError(message: string) {
    setImportError(true)
    setImportMessage(message)
  }

  function exportCsv() {
    const rows = [
      templateHeaders,
      ...filtered.map((company) => [company.name, company.sector, company.region, company.size, company.stage, String(company.autonomy), String(company.efficiency), company.useCase, company.measured ? 'yes' : 'no']),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'agent-adoption-records.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function downloadTemplate() {
    const csv = `${templateHeaders.map(csvCell).join(',')}\n`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'agent-adoption-template.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showImportError('Choose a .csv file.')
      return
    }
    if (file.size > maxUploadBytes) {
      showImportError('File exceeds the 2 MB upload limit.')
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      showImportError('The selected file could not be read.')
      return
    }
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().toLowerCase(),
    })
    const headers = result.meta.fields ?? []
    const missing = requiredHeaders.filter((header) => !headers.includes(header))
    if (missing.length) {
      showImportError(`Missing required columns: ${missing.join(', ')}.`)
      return
    }
    if (result.errors.length) {
      showImportError(`CSV parsing failed: ${result.errors[0].message}`)
      return
    }
    if (result.data.length === 0 || result.data.length > maxRows) {
      showImportError(`Upload between 1 and ${maxRows.toLocaleString()} records.`)
      return
    }

    const errors: string[] = []
    const imported = result.data.map((row, index) => {
      const line = index + 2
      const stage = row.stage?.trim().toLowerCase()
      const autonomy = Number(row.autonomy_score)
      const efficiency = Number(row.efficiency_gain_pct)
      const measured = row.measured_outcome?.trim().toLowerCase()
      const fields = [row.enterprise, row.sector, row.region, row.size, row.primary_use_case]
      if (fields.some((field) => !field?.trim())) errors.push(`Row ${line}: text fields cannot be blank.`)
      if (!['production', 'pilot', 'exploring'].includes(stage ?? '')) errors.push(`Row ${line}: stage must be production, pilot, or exploring.`)
      if (!row.autonomy_score?.trim() || !Number.isFinite(autonomy) || autonomy < 0 || autonomy > 100) errors.push(`Row ${line}: autonomy_score must be 0-100.`)
      if (!row.efficiency_gain_pct?.trim() || !Number.isFinite(efficiency) || efficiency < 0 || efficiency > 100) errors.push(`Row ${line}: efficiency_gain_pct must be 0-100.`)
      if (!['yes', 'no', 'true', 'false'].includes(measured ?? '')) errors.push(`Row ${line}: measured_outcome must be yes or no.`)
      return {
        name: row.enterprise?.trim() ?? '',
        sector: row.sector?.trim() ?? '',
        region: row.region?.trim() ?? '',
        size: row.size?.trim() ?? '',
        stage: stage === 'production' ? 'Production' as const : stage === 'pilot' ? 'Pilot' as const : 'Exploring' as const,
        autonomy,
        efficiency,
        useCase: row.primary_use_case?.trim() ?? '',
        measured: measured === 'yes' || measured === 'true',
      }
    })
    if (errors.length) {
      const shownErrors = errors.slice(0, 4).join(' ')
      showImportError(`${shownErrors}${errors.length > 4 ? ` Plus ${errors.length - 4} more issue(s).` : ''}`)
      return
    }

    setDataset({ companies: imported, imported: true })
    setSector('All sectors')
    setRegion('All regions')
    setSize('All sizes')
    try {
      localStorage.setItem(storageKey, JSON.stringify(imported))
      setImportError(false)
      setImportMessage(`Imported ${imported.length} ${imported.length === 1 ? 'record' : 'records'} and saved them in this browser.`)
    } catch {
      setImportError(false)
      setImportMessage(`Imported ${imported.length} ${imported.length === 1 ? 'record' : 'records'} for this session; browser storage is unavailable.`)
    }
  }

  function resetDataset() {
    let storageCleared = true
    try {
      localStorage.removeItem(storageKey)
    } catch {
      storageCleared = false
    }
    setDataset({ companies, imported: false })
    setSector('All sectors')
    setRegion('All regions')
    setSize('All sizes')
    setImportError(false)
    setImportMessage(storageCleared ? 'Restored the illustrative sample dataset.' : 'Restored the sample for this session; browser storage could not be cleared.')
  }

  function selectNav(label: string) {
    setActiveNav(label)
    document.getElementById(label.toLowerCase().replaceAll(' ', '-'))?.scrollIntoView({ behavior: 'smooth' })
  }

  async function runDemoReview() {
    if (!quantityInputsValid) return
    const startedAt = timestampNow()
    const events: AuditEvent[] = [{
      timestamp: startedAt,
      actor: 'Rule simulation',
      action: 'Review started',
      detail: `Compared ${shipmentLines.length} manually entered item rows: invoice total ${invoiceCount}; packing-list total ${packingCount}.`,
    }]
    setShipmentAudit(null)
    setDemoStatus('running')
    setCompletedDemoSteps(0)
    for (let index = 0; index < demoSteps.length; index += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 400))
      setCompletedDemoSteps(index + 1)
      const isVarianceCheck = index === 1
      const isRecommendation = index === 3
      events.push({
        timestamp: timestampNow(),
        actor: 'Rule simulation',
        action: demoSteps[index].title,
        detail: isVarianceCheck
          ? quantityMismatch ? `${mismatchedLineCount} of ${shipmentLines.length} items mismatch; absolute variance ${quantityVariance} units.` : `All ${shipmentLines.length} items match; both totals are ${invoiceCount} units.`
          : isRecommendation ? quantityMismatch ? 'Stopped and requested human review.' : 'Prepared for human confirmation; no shipment action taken.'
          : demoSteps[index].detail,
      })
    }
    const nextStatus = quantityMismatch ? 'review' : 'ready-for-confirmation'
    setDemoStatus(nextStatus)
    const completedAt = timestampNow()
    setShipmentAudit({
      runId: `DEMO-${startedAt.replaceAll(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`,
      startedAt,
      completedAt,
      mode: 'local-rule-simulation',
      invoiceQuantity: invoiceCount,
      packingQuantity: packingCount,
      variance: quantityVariance,
      mismatchedLineCount,
      lineItems: parsedShipmentLines.map((line) => ({
        sku: line.sku,
        description: line.description,
        invoiceQuantity: line.invoiceCount,
        packingQuantity: line.packingCount,
        variance: Math.abs(line.invoiceCount - line.packingCount),
      })),
      systemDecision: quantityMismatch ? 'HOLD_FOR_HUMAN_REVIEW' : 'READY_FOR_HUMAN_CONFIRMATION',
      reviewerDecision: 'PENDING',
      events,
    })
  }

  function resetDemoReview() {
    setDemoStatus('ready')
    setCompletedDemoSteps(0)
    setShipmentAudit(null)
  }

  function updateShipmentLine(id: string, field: 'invoiceQuantity' | 'packingQuantity', value: string) {
    setShipmentLines((lines) => lines.map((line) => line.id === id ? { ...line, [field]: value } : line))
    resetDemoReview()
  }

  function recordReviewerDecision(decision: 'REQUESTED_CORRECTION' | 'CONFIRMED_REVIEW') {
    const detail = decision === 'REQUESTED_CORRECTION'
      ? 'Reviewer requested a corrected packing list; shipment remains on hold.'
      : 'Reviewer confirmed the demo packet; no shipment was submitted or released.'
    setShipmentAudit((current) => current ? {
      ...current,
      reviewerDecision: decision,
      events: [...current.events, { timestamp: timestampNow(), actor: 'Human reviewer', action: decision, detail }],
    } : current)
    setDemoStatus(decision === 'REQUESTED_CORRECTION' ? 'correction-requested' : 'review-confirmed')
  }

  function exportShipmentAudit() {
    if (!shipmentAudit) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(shipmentAudit, null, 2)], { type: 'application/json' }))
    link.download = `${shipmentAudit.runId.toLowerCase()}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Fieldwork home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>fieldwork<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-switcher"><span className="workspace-dot">L</span><span><b>Local market</b><small>Research workspace</small></span><span className="chevron">⌄</span></div>
        <p className="nav-label">RESEARCH</p>
        <nav aria-label="Main navigation">
          {['Overview', 'Adoption', 'Shipment demo', 'Use cases', 'Governance'].map((item, index) => (
            <button className={`nav-item ${activeNav === item ? 'selected' : ''}`} key={item} onClick={() => selectNav(item)}>
              <span className={`nav-symbol nav-symbol-${index}`} aria-hidden="true">{['◫', '↗', '⇢', '⌘', '◉'][index]}</span>{item}
              {item === 'Governance' && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-status"><span className="status-light" /><span><b>{dataset.imported ? 'Imported dataset' : 'Sample dataset'}</b><small>{companies.length} {dataset.imported ? 'uploaded records' : 'illustrative records'}</small></span></div>
          <button className="profile-button"><span className="avatar">AR</span><span><b>Analyst workspace</b><small>Research team</small></span><span className="chevron">···</span></button>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Research <span>/</span> <b>Agent systems index</b></div>
          <div className="topbar-right"><span className="updated"><span className="live-dot" /> Updated 10 Oct 2026</span><button className="import-button" onClick={() => fileInput.current?.click()}><span aria-hidden="true">↑</span> Import CSV</button><button className="export-button" onClick={exportCsv}><span aria-hidden="true">↧</span> Export CSV</button><input ref={fileInput} className="file-input" type="file" accept=".csv,text/csv" onChange={importCsv} aria-label="Import enterprise records CSV" /></div>
        </header>

        <section className="intro-section">
          <div className="intro-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> FIELD NOTES <span className="eyebrow-index">/ 01</span></div>
            <h1>Autonomy,<br /><em>in the real world.</em></h1>
            <p className="intro-description">A working view of how enterprises are putting AI agents to work, what they trust them with, and where value is beginning to show up.</p>
          </div>
          <div className="intro-art" aria-label="Abstract illustration of connected agent workflows" role="img">
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-node node-one">01</div><div className="art-node node-two">02</div><div className="art-node node-three">03</div><div className="art-core"><span>AI</span><small>AGENT<br />SYSTEMS</small></div><span className="art-caption">OBSERVE <i>·</i> DECIDE <i>·</i> ACT</span>
          </div>
        </section>

        <section className="filter-row" aria-label="Dashboard filters">
          <div className="filter-context"><span className="filter-label">VIEWING</span><span className={`sample-pill ${dataset.imported ? 'imported-pill' : ''}`}><span /> {dataset.imported ? 'Imported dataset' : 'Illustrative sample'}</span><button className="template-link" onClick={downloadTemplate}>CSV template <span>↓</span></button>{dataset.imported && <button className="reset-link" onClick={resetDataset}>Reset sample</button>}</div>
          <div className="filter-controls">
            <label><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>Industry</span><select value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>Company size</span><select value={size} onChange={(event) => setSize(event.target.value)}>{sizes.map((option) => <option key={option}>{option}</option>)}</select></label>
          </div>
        </section>
        {importMessage && <div className={`import-message ${importError ? 'has-error' : ''}`} role={importError ? 'alert' : 'status'}><span>{importMessage}</span><button onClick={() => setImportMessage('')} aria-label="Dismiss import message">×</button></div>}

        <section className="metrics-grid" aria-label="Adoption summary">
          <article className="metric-card metric-primary">
            <div className="metric-top"><span>IN PRODUCTION</span><span className="metric-index">01</span></div>
            <div className="metric-value">{productionRate}<span>%</span></div>
            <div className="metric-bottom"><span className="metric-note">{production.length} of {filtered.length} enterprises</span><span className="metric-arrow">↗</span></div>
            <div className="metric-rule"><i style={{ width: `${productionRate}%` }} /></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>IN ACTIVE PILOT</span><span className="metric-index">02</span></div>
            <div className="metric-value">{pilots.length.toString().padStart(2, '0')}<span className="metric-unit"> / {filtered.length.toString().padStart(2, '0')}</span></div>
            <div className="metric-bottom"><span className="metric-note">Testing in live workflows</span><span className="metric-spark">▂▃▅▆▇</span></div>
            <div className="metric-rule"><i style={{ width: `${filtered.length ? (pilots.length / filtered.length) * 100 : 0}%` }} /></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>MEAN AUTONOMY</span><span className="metric-index">03</span></div>
            <div className="metric-value">{avgAutonomy}<span className="metric-unit"> / 100</span></div>
            <div className="metric-bottom"><span className="metric-note">Human oversight still varies</span><span className="metric-tag">BOUNDED</span></div>
            <div className="metric-rule"><i style={{ width: `${avgAutonomy}%` }} /></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>EFFICIENCY SIGNAL</span><span className="metric-index">04</span></div>
            <div className="metric-value">{avgEfficiency}<span>%</span></div>
            <div className="metric-bottom"><span className="metric-note">Mean reported efficiency gain</span><span className="metric-arrow">↗</span></div>
            <div className="metric-rule"><i style={{ width: `${Math.min(avgEfficiency * 2, 100)}%` }} /></div>
          </article>
        </section>

        <section className="shipment-demo" id="shipment-demo" aria-labelledby="shipment-title">
          <div className="shipment-heading">
            <div><span className="section-kicker">HACKATHON SCENARIO / EXPORT OPERATIONS</span><h2 id="shipment-title">One shipment. One human checkpoint.</h2><p>See how a bounded agent could prepare an export-document review and stop when the evidence does not agree.</p></div>
            <span className="simulation-badge"><i /> SCRIPTED SIMULATION</span>
          </div>
          <div className="shipment-grid">
            <article className="shipment-case">
              <div className="shipment-case-top"><span className="case-id">SHIPMENT / SHP-2048</span><span className="case-status">{demoStatus === 'correction-requested' ? 'CORRECTION REQUESTED' : demoStatus === 'review-confirmed' ? 'REVIEW CONFIRMED' : demoStatus === 'ready-for-confirmation' ? 'MATCHED · REVIEW' : demoStatus === 'review' ? 'REVIEW REQUIRED' : demoStatus === 'running' ? 'REVIEW RUNNING' : !quantityInputsValid ? 'CHECK QUANTITIES' : quantityMismatch ? 'VARIANCE TO CHECK' : 'READY TO REVIEW'}</span></div>
              <div className="case-subject"><span className="case-icon">EX</span><div><b>Precision components</b><small>Local exporter <i>·</i> destination not specified</small></div></div>
              <div className="line-item-table-wrap"><table className="line-item-table"><thead><tr><th scope="col">LINE ITEM</th><th scope="col">INVOICE</th><th scope="col">PACKING</th><th scope="col">VAR.</th></tr></thead><tbody>{shipmentLines.map((line) => {
                const invoiceLineCount = Number(line.invoiceQuantity)
                const packingLineCount = Number(line.packingQuantity)
                const validLine = line.invoiceQuantity.trim() !== '' && line.packingQuantity.trim() !== '' && [invoiceLineCount, packingLineCount].every((quantity) => Number.isInteger(quantity) && quantity >= 0 && quantity <= 100000)
                const lineVariance = validLine ? Math.abs(invoiceLineCount - packingLineCount) : null
                return <tr key={line.id}><th scope="row"><b>{line.sku}</b><small>{line.description}</small></th><td><input aria-label={`${line.description} invoice quantity`} type="number" min="0" max="100000" step="1" value={line.invoiceQuantity} disabled={demoStatus === 'running'} onChange={(event) => updateShipmentLine(line.id, 'invoiceQuantity', event.target.value)} /></td><td><input aria-label={`${line.description} packing-list quantity`} type="number" min="0" max="100000" step="1" value={line.packingQuantity} disabled={demoStatus === 'running'} onChange={(event) => updateShipmentLine(line.id, 'packingQuantity', event.target.value)} /></td><td><span className={`line-variance ${lineVariance === null ? 'invalid' : lineVariance ? 'mismatch' : 'matched'}`}>{lineVariance === null ? 'Check' : lineVariance.toLocaleString()}</span></td></tr>
              })}</tbody><tfoot><tr><th scope="row">TOTALS</th><td>{quantityInputsValid ? invoiceCount.toLocaleString() : 'Invalid'}</td><td>{quantityInputsValid ? packingCount.toLocaleString() : 'Invalid'}</td><td className={quantityMismatch ? 'variance-value' : 'matched-value'}>{quantityInputsValid ? quantityVariance.toLocaleString() : '—'}</td></tr></tfoot></table></div>
              <div className={`variance-callout ${quantityInputsValid && !quantityMismatch ? 'variance-cleared' : ''} ${!quantityInputsValid ? 'variance-invalid' : ''}`}><span className="variance-mark">{!quantityInputsValid ? '?' : quantityMismatch ? '!' : '✓'}</span><span><b>{!quantityInputsValid ? 'Enter valid whole-number quantities' : quantityMismatch ? `${mismatchedLineCount} line item${mismatchedLineCount === 1 ? '' : 's'} differ` : 'All line-item quantities align'}</b><small>{!quantityInputsValid ? 'Use whole numbers from 0 to 100,000 for each row.' : quantityMismatch ? `Absolute variance: ${quantityVariance.toLocaleString()} units across ${mismatchedLineCount} item${mismatchedLineCount === 1 ? '' : 's'}. Do not proceed until a reviewer resolves it.` : 'A reviewer must still confirm the documents before the next process step.'}</small></span></div>
              <div className="review-actions">
                {demoStatus === 'ready' && <button className="run-review-button" disabled={!quantityInputsValid} onClick={runDemoReview}><span>▶</span> Run demo review</button>}
                {demoStatus === 'running' && <button className="run-review-button" disabled><span className="run-spinner" /> Reviewing documents…</button>}
                {demoStatus === 'review' && <button className="run-review-button correction-button" onClick={() => recordReviewerDecision('REQUESTED_CORRECTION')}>Request corrected packing list <span>↗</span></button>}
                {demoStatus === 'ready-for-confirmation' && <button className="run-review-button" onClick={() => recordReviewerDecision('CONFIRMED_REVIEW')}>Confirm human review <span>✓</span></button>}
                {(demoStatus === 'correction-requested' || demoStatus === 'review-confirmed') && <button className="run-review-button" onClick={resetDemoReview}>Reset scenario <span>↺</span></button>}
                <span className="review-disclaimer">Demo only. No export action is taken.</span>
              </div>
            </article>

            <article className="agent-trace">
              <div className="trace-heading"><div><span className="trace-pulse" /><b>Rule-based review</b></div><span>{demoStatus === 'running' ? 'PROCESSING' : demoStatus === 'review' || demoStatus === 'ready-for-confirmation' || demoStatus === 'correction-requested' || demoStatus === 'review-confirmed' ? 'COMPLETE' : 'IDLE'}</span></div>
              <ol className="trace-steps">
                {demoSteps.map((step, index) => {
                  const isComplete = index < completedDemoSteps
                  const isCurrent = demoStatus === 'running' && index === completedDemoSteps
                  const hasVariance = isComplete && index === 1 && quantityMismatch
                  const detail = isComplete && index === 1 ? quantityMismatch ? `${mismatchedLineCount} of ${shipmentLines.length} line items differ; absolute variance ${quantityVariance.toLocaleString()} units.` : `All ${shipmentLines.length} line items match; totals are ${invoiceCount.toLocaleString()} units.` : isComplete && index === 3 ? quantityMismatch ? 'Hold for human review until the line-item variance is resolved.' : 'Line items agree; reviewer confirmation is still required.' : step.detail
                  return <li className={`${isComplete ? 'step-complete' : ''} ${isCurrent ? 'step-current' : ''} ${hasVariance ? 'step-warning' : ''}`} key={step.title}><span className="step-marker">{isComplete ? hasVariance ? '!' : '✓' : String(index + 1).padStart(2, '0')}</span><span className="step-content"><b>{step.title}</b><small>{isComplete ? detail : isCurrent ? 'Checking source documents…' : 'Waiting'}</small></span><span className="step-state">{hasVariance ? 'FLAGGED' : isComplete ? 'DONE' : isCurrent ? 'RUNNING' : 'PENDING'}</span></li>
                })}
              </ol>
              <div className={`human-gate ${demoStatus === 'review' || demoStatus === 'correction-requested' || demoStatus === 'ready-for-confirmation' || demoStatus === 'review-confirmed' ? 'gate-active' : ''}`}><span className="gate-icon">H</span><span><b>Human approval gate</b><small>{demoStatus === 'correction-requested' ? 'Reviewer requested corrected source documents.' : demoStatus === 'review-confirmed' ? 'Reviewer confirmed this demo packet. Nothing was submitted.' : demoStatus === 'review' ? 'Agent stopped. A reviewer must resolve the variance.' : demoStatus === 'ready-for-confirmation' ? 'Documents align. Reviewer confirmation is still required.' : 'The agent cannot submit or release this shipment.'}</small></span><span className="gate-lock">{demoStatus === 'correction-requested' ? 'HOLD' : 'REQUIRED'}</span></div>
            </article>
          </div>
          {shipmentAudit && <section className="audit-panel" aria-label="Shipment review audit record">
            <div className="audit-header"><div><span className="section-kicker">RUN RECORD / {shipmentAudit.events.length} EVENTS</span><h3>Review audit trail</h3><code>{shipmentAudit.runId}</code></div><button className="audit-export" onClick={exportShipmentAudit}><span>↧</span> Export JSON</button></div>
            <div className="audit-summary"><div><span>SIMULATION MODE</span><b>Local rule check</b></div><div><span>LINE ITEMS FLAGGED</span><b>{shipmentAudit.mismatchedLineCount} / {shipmentAudit.lineItems.length}</b></div><div><span>ABSOLUTE VARIANCE</span><b>{shipmentAudit.variance.toLocaleString()} units</b></div><div><span>SYSTEM DECISION</span><b>{shipmentAudit.systemDecision.replaceAll('_', ' ')}</b></div><div><span>REVIEWER ACTION</span><b>{shipmentAudit.reviewerDecision.replaceAll('_', ' ')}</b></div></div>
            <div className="audit-lines"><span>LINE-ITEM RECONCILIATION</span>{shipmentAudit.lineItems.map((line) => <div key={line.sku}><b>{line.sku}</b><span>{line.description}</span><span>{line.invoiceQuantity.toLocaleString()} / {line.packingQuantity.toLocaleString()}</span><strong className={line.variance ? 'variance-value' : 'matched-value'}>{line.variance ? `${line.variance.toLocaleString()} variance` : 'Matched'}</strong></div>)}</div>
            <ol className="audit-events">{shipmentAudit.events.map((event, index) => <li key={`${event.timestamp}-${event.action}`}><span className="audit-event-index">{String(index + 1).padStart(2, '0')}</span><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span className="audit-event-copy"><b>{event.action.replaceAll('_', ' ')}</b><small>{event.detail}</small></span><span className="audit-actor">{event.actor}</span></li>)}</ol>
            <p className="audit-note">This local demo record contains manually entered quantities and simulation events only. It is not a customs filing or compliance determination.</p>
          </section>}
          <div className="impact-strip"><div className="impact-title"><span className="section-kicker">ILLUSTRATIVE IMPACT</span><b>Review-time model</b><small>Scenario estimate only; not measured results.</small></div><div className="impact-measure"><span>Manual baseline</span><b>42 <small>min</small></b><div className="impact-track"><i className="baseline-bar" /></div></div><span className="impact-arrow">→</span><div className="impact-measure assisted"><span>Agent-assisted + human review</span><b>16 <small>min</small></b><div className="impact-track"><i className="assisted-bar" /></div></div><div className="impact-delta"><b>−62%</b><small>modeled time</small></div></div>
        </section>

        <section className="insights-grid" id="adoption">
          <article className="panel adoption-panel">
            <div className="panel-heading"><div><span className="section-kicker">01 / MOMENTUM</span><h2>Adoption is accelerating</h2></div><button className="more-button" aria-label="More adoption information">···</button></div>
            <div className="chart-legend"><span><i className="legend-current" /> Production deployments</span><span className="chart-unit">% OF TRACKED ENTERPRISES</span></div>
            <div className="chart-area" role="img" aria-label="Illustrative production adoption trend from 32 percent in May to 61 percent in October">
              <div className="chart-guides"><span>75%</span><i /><span>50%</span><i /><span>25%</span><i /><span>0%</span></div>
              <div className="chart-bars">{trend.map((point, index) => <div className="chart-column" key={point.month} style={{ '--bar-height': `${point.value}%` } as React.CSSProperties}><div className={`bar-value ${index === trend.length - 1 ? 'latest-value' : ''}`}>{point.value}%</div><div className={`chart-bar ${index === trend.length - 1 ? 'latest-bar' : ''}`} style={{ height: `${point.value}%` }} /><span className="chart-month">{point.month}</span></div>)}</div>
            </div>
            <div className="chart-footnote"><span>Six-month signal</span><b>+29 pts</b><span className="footnote-detail">Illustrative trend, not a market estimate</span></div>
          </article>

          <article className="panel autonomy-panel">
            <div className="panel-heading"><div><span className="section-kicker">02 / DELEGATION</span><h2>How much do they trust?</h2></div><span className="panel-count">{filtered.length} orgs</span></div>
            <p className="panel-deck">A practical autonomy ladder, from advice to action.</p>
            <div className="autonomy-ladder">
              <div className="ladder-row"><span className="ladder-number">01</span><div className="ladder-copy"><b>Assist</b><small>Recommends; people execute</small></div><div className="ladder-track"><i style={{ width: `${filtered.length ? filtered.filter((company) => company.autonomy < 25).length / filtered.length * 100 : 0}%` }} /></div><b className="ladder-total">{filtered.filter((company) => company.autonomy < 25).length}</b></div>
              <div className="ladder-row"><span className="ladder-number">02</span><div className="ladder-copy"><b>Supervise</b><small>Acts with human approval</small></div><div className="ladder-track"><i style={{ width: `${filtered.length ? filtered.filter((company) => company.autonomy >= 25 && company.autonomy < 50).length / filtered.length * 100 : 0}%` }} /></div><b className="ladder-total">{filtered.filter((company) => company.autonomy >= 25 && company.autonomy < 50).length}</b></div>
              <div className="ladder-row"><span className="ladder-number">03</span><div className="ladder-copy"><b>Bounded</b><small>Acts inside defined guardrails</small></div><div className="ladder-track"><i style={{ width: `${filtered.length ? filtered.filter((company) => company.autonomy >= 50).length / filtered.length * 100 : 0}%` }} /></div><b className="ladder-total">{filtered.filter((company) => company.autonomy >= 50).length}</b></div>
            </div>
            <div className="human-note"><span>↳</span> Human approval remains the default for high-impact actions.</div>
          </article>
        </section>

        <section className="lower-grid" id="use-cases">
          <article className="panel workflow-panel">
            <div className="panel-heading"><div><span className="section-kicker">03 / WHERE IT LANDS</span><h2>Workflows with traction</h2></div><button className="text-link" onClick={() => selectNav('Use cases')}>Explore use cases <span>↗</span></button></div>
            <div className="workflow-list">
              {[
                { name: 'Operations & logistics', detail: 'Routing, exceptions, fulfilment', count: filtered.filter((company) => ['Logistics', 'Manufacturing'].includes(company.sector)).length, color: 'coral', number: '01' },
                { name: 'Risk & compliance', detail: 'Evidence review, reporting, controls', count: filtered.filter((company) => ['Financial services', 'Energy'].includes(company.sector)).length, color: 'yellow', number: '02' },
                { name: 'Customer & care', detail: 'Service, claims, coordination', count: filtered.filter((company) => ['Retail', 'Healthcare'].includes(company.sector)).length, color: 'mint', number: '03' },
              ].map((workflow) => <div className="workflow-row" key={workflow.name}><span className={`workflow-glyph ${workflow.color}`}>{workflow.number}</span><div className="workflow-name"><b>{workflow.name}</b><small>{workflow.detail}</small></div><div className="workflow-mini-bars"><i style={{ height: `${Math.max(workflow.count * 12, 6)}px` }} /><i style={{ height: `${Math.max(workflow.count * 17, 9)}px` }} /><i style={{ height: `${Math.max(workflow.count * 21, 11)}px` }} /><i style={{ height: `${Math.max(workflow.count * 27, 14)}px` }} /></div><span className="workflow-count">{workflow.count.toString().padStart(2, '0')}<small> cases</small></span></div>)}
            </div>
          </article>

          <article className="panel proof-panel" id="governance">
            <div className="panel-heading"><div><span className="section-kicker">04 / EVIDENCE QUALITY</span><h2>Proof before promise</h2></div><span className="proof-stamp">FIELD GUIDE</span></div>
            <div className="proof-score"><span className="proof-number">{measuredCount.toString().padStart(2, '0')}</span><div><b>of {filtered.length} records</b><small>include measured before / after outcomes</small></div></div>
            <div className="proof-meter"><i style={{ width: `${filtered.length ? measuredCount / filtered.length * 100 : 0}%` }} /></div>
            <p className="proof-copy">Reported efficiency is a signal, not proof of impact. Track the baseline, human review time, error rate, and exceptions alongside every claimed gain.</p>
            <button className="proof-link" onClick={() => selectNav('Governance')}>View measurement checklist <span>↗</span></button>
          </article>
        </section>

        <footer className="dashboard-footer"><span><b>FIELDWORK / 2026</b> &nbsp; · &nbsp; Research prototype</span><span>{dataset.imported ? 'Uploaded records are user-supplied; the six-month adoption trend remains illustrative.' : 'All records and trend values are synthetic. Replace with validated local-market data before drawing conclusions.'}</span></footer>
      </main>
    </div>
  )
}

export default App
