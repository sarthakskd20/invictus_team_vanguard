import { useState, useEffect } from 'react';
import { productionAPI, pcbAPI, reportAPI } from '../services/api';
import { Factory, AlertTriangle, CheckCircle, X, Clock, ChevronDown, ChevronUp, Lock, Download } from 'lucide-react';
import { GlowingEffect } from '../components/ui/glowing-effect';

export default function ProductionPage() {
    const [pcbs, setPcbs] = useState([]);
    const [history, setHistory] = useState([]);
    const [selectedPcb, setSelectedPcb] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [bomPreview, setBomPreview] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [expandedEntry, setExpandedEntry] = useState(null);
    const [entryDetail, setEntryDetail] = useState(null);
    const [shortageDetails, setShortageDetails] = useState(null);
    const [concurrencyNote, setConcurrencyNote] = useState('');

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (selectedPcb) loadBomPreview(selectedPcb);
        else setBomPreview([]);
    }, [selectedPcb]);

    const loadData = async () => {
        try {
            const [pcbRes, histRes] = await Promise.all([
                pcbAPI.getAll(),
                productionAPI.getHistory({ limit: 20 })
            ]);
            setPcbs(pcbRes.data);
            setHistory(histRes.data);
        } catch { setError('Failed to load data.'); }
        finally { setLoading(false); }
    };

    const loadBomPreview = async (pcbId) => {
        try {
            const res = await pcbAPI.getBom(pcbId);
            setBomPreview(res.data);
        } catch { setBomPreview([]); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPcb || quantity <= 0) return;

        setError('');
        setResult(null);
        setShortageDetails(null);
        setConcurrencyNote('');
        setSubmitting(true);

        try {
            const res = await productionAPI.createEntry({
                pcb_id: parseInt(selectedPcb),
                quantity_produced: parseInt(quantity),
                notes
            });
            setResult(res.data);
            setSelectedPcb('');
            setQuantity(1);
            setNotes('');
            setBomPreview([]);
            loadData();
        } catch (err) {
            const data = err.response?.data;
            setError(data?.error || 'Production entry failed.');

            // Show structured shortage details if available
            if (data?.shortages && data.shortages.length > 0) {
                setShortageDetails(data.shortages);
            }

            // Show concurrency context note
            if (data?.concurrency_note) {
                setConcurrencyNote(data.concurrency_note);
            }

            // Auto-refresh BOM preview so user sees updated stock values
            if (selectedPcb) {
                loadBomPreview(selectedPcb);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const toggleEntryDetail = async (entryId) => {
        if (expandedEntry === entryId) { setExpandedEntry(null); return; }
        try {
            const res = await productionAPI.getDetail(entryId);
            setEntryDetail(res.data);
            setExpandedEntry(entryId);
        } catch { setError('Failed to load entry details.'); }
    };



    // Download helper
    const downloadBlob = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleExportBOM = async () => {
        try {
            const res = await reportAPI.exportBOM(selectedPcb, quantity);
            downloadBlob(new Blob([res.data]), `BOM_x${quantity}.xlsx`);
        } catch { setError('Failed to export BOM.'); }
    };

    const handleExportShortage = async () => {
        try {
            const res = await reportAPI.exportShortageReport(selectedPcb, quantity);
            downloadBlob(new Blob([res.data]), `Shortage_x${quantity}.xlsx`);
        } catch { setError('Failed to export shortage report.'); }
    };

    const handleExportProcurement = async () => {
        try {
            const res = await reportAPI.exportProcurementList(selectedPcb, quantity);
            downloadBlob(new Blob([res.data]), `Procurement_x${quantity}.xlsx`);
        } catch { setError('Failed to export procurement list.'); }
    };

    // Compute impact summary
    const impactData = bomPreview.map(item => {
        const needed = item.quantity_per_unit * quantity;
        const afterBuild = item.current_stock - needed;
        return { ...item, needed, afterBuild, sufficient: afterBuild >= 0 };
    });
    const shortageCount = impactData.filter(d => !d.sufficient).length;
    const sufficientCount = impactData.filter(d => d.sufficient).length;

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Production Entry</h1>
                    <p className="page__subtitle">Record PCB production and deduct component stock</p>
                </div>
            </div>

            {error && (
                <div className="alert alert--error">
                    <div style={{ flex: 1 }}>
                        <p>{error}</p>
                        {concurrencyNote && (
                            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Lock size={12} /> {concurrencyNote}
                            </p>
                        )}
                    </div>
                    <button onClick={() => { setError(''); setShortageDetails(null); setConcurrencyNote(''); }}><X size={14} /></button>
                </div>
            )}

            {shortageDetails && shortageDetails.length > 0 && (
                <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--clr-error, #ef4444)' }}>
                    <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                    <h4 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={16} /> Component Shortage Details
                    </h4>
                    <table className="data-table data-table--compact">
                        <thead>
                            <tr><th>Component</th><th>Part #</th><th>Required</th><th>Available</th><th>Deficit</th></tr>
                        </thead>
                        <tbody>
                            {shortageDetails.map((s, i) => (
                                <tr key={i} style={{ color: 'var(--color-danger, #ef4444)' }}>
                                    <td>{s.component}</td>
                                    <td className="td--mono" style={{ color: 'inherit' }}>{s.part_number}</td>
                                    <td>{s.needed.toLocaleString()}</td>
                                    <td>{s.available.toLocaleString()}</td>
                                    <td style={{ fontWeight: 600 }}>-{s.shortage.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {result && (
                <div className={`alert ${result.warnings ? 'alert--warning' : 'alert--success'}`}>
                    <div>
                        <p><strong>{result.message}</strong></p>
                        {result.warnings && <p>{result.warnings}</p>}
                        {result.procurement_triggers?.length > 0 && (
                            <ul className="alert__list">
                                {result.procurement_triggers.map((t, i) => (
                                    <li key={i}>{t.component} ({t.part_number}) — {t.remaining_stock} remaining, threshold: {t.threshold}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <button onClick={() => setResult(null)}><X size={14} /></button>
                </div>
            )}

            <div className="production-layout">
                <div className="card production-form-card">
                    <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                    <h3 className="card__title"><Factory size={16} /> New Production Entry</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="pcb_select">Select PCB Type</label>
                            <select id="pcb_select" value={selectedPcb} onChange={e => setSelectedPcb(e.target.value)} required>
                                <option value="">Choose a PCB type...</option>
                                {pcbs.map(p => <option key={p.pcb_id} value={p.pcb_id}>{p.pcb_name} ({p.pcb_code})</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="qty">Quantity to Produce</label>
                            <input
                                id="qty"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={e => {
                                    const val = e.target.value;
                                    setQuantity(val === '' ? '' : parseInt(val));
                                }}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="prod_notes">Notes (optional)</label>
                            <textarea id="prod_notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Production batch notes..." />
                        </div>

                        {bomPreview.length > 0 && (
                            <div className="bom-preview">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0 }}>Inventory Impact Preview (x{quantity})</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--clr-success-bg, #dcfce7)', color: 'var(--clr-success, #16a34a)' }}>
                                            ✓ {sufficientCount} OK
                                        </span>
                                        {shortageCount > 0 && (
                                            <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--clr-error-bg, #fef2f2)', color: 'var(--clr-error, #ef4444)' }}>
                                                ✗ {shortageCount} Short
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <table className="data-table data-table--compact">
                                    <thead>
                                        <tr><th>Component</th><th>Part #</th><th>Needed</th><th>Available</th><th>After Build</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {impactData.map((item, i) => (
                                            <tr key={i} style={!item.sufficient ? { background: 'var(--color-danger-dim, rgba(239, 68, 68, 0.12))', color: 'var(--color-danger, #ef4444)' } : {}}>
                                                <td>{item.component_name}</td>
                                                <td className="td--mono" style={!item.sufficient ? { color: 'inherit' } : {}}>{item.part_number}</td>
                                                <td>{item.needed.toLocaleString()}</td>
                                                <td>{item.current_stock.toLocaleString()}</td>
                                                <td style={{ fontWeight: 600, color: item.afterBuild < 0 ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #22c55e)' }}>
                                                    {item.afterBuild.toLocaleString()}
                                                </td>
                                                <td>
                                                    {item.sufficient ? (
                                                        <span className="stock-badge stock-badge--normal"><CheckCircle size={12} /> OK</span>
                                                    ) : (
                                                        <span className="stock-badge stock-badge--critical"><AlertTriangle size={12} /> Short {Math.abs(item.afterBuild)}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Export Buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn--outline" onClick={handleExportBOM} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                                        <Download size={13} /> Export BOM
                                    </button>
                                    {shortageCount > 0 && (
                                        <>
                                            <button type="button" className="btn btn--outline" onClick={handleExportShortage} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderColor: 'var(--clr-error, #ef4444)', color: 'var(--clr-error, #ef4444)' }}>
                                                <Download size={13} /> Shortage Report
                                            </button>
                                            <button type="button" className="btn btn--outline" onClick={handleExportProcurement} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderColor: 'var(--clr-primary, #3b82f6)', color: 'var(--clr-primary, #3b82f6)' }}>
                                                <Download size={13} /> Procurement List
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <button type="submit" className="btn btn--primary btn--full" disabled={submitting || bomPreview.length === 0}>
                            {submitting ? <span className="btn-loading" /> : <><Factory size={16} /> Create Production Entry</>}
                        </button>
                    </form>
                </div>

                <div className="card">
                    <GlowingEffect spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
                    <h3 className="card__title"><Clock size={16} /> Recent Production History</h3>
                    {history.length > 0 ? (
                        <div className="production-history">
                            {history.map(entry => (
                                <div key={entry.entry_id} className="history-item">
                                    <div className="history-item__header" onClick={() => toggleEntryDetail(entry.entry_id)}>
                                        <div>
                                            <p className="history-item__name">{entry.pcb_name}</p>
                                            <p className="history-item__meta">{entry.quantity_produced} units &middot; {new Date(entry.production_date).toLocaleDateString()} &middot; by {entry.produced_by_name}</p>
                                        </div>
                                        {expandedEntry === entry.entry_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                    {expandedEntry === entry.entry_id && entryDetail && (
                                        <div className="history-item__detail">
                                            {entryDetail.transactions?.map((t, i) => (
                                                <div key={i} className="transaction-row">
                                                    <span>{t.component_name}</span>
                                                    <span className="transaction-row__change">{t.quantity_changed}</span>
                                                    <span className="td--mono">{t.balance_before} &rarr; {t.balance_after}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="card__empty">No production entries recorded yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
