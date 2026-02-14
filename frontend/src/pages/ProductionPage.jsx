import { useState, useEffect } from 'react';
import { productionAPI, pcbAPI } from '../services/api';
import { Factory, AlertTriangle, CheckCircle, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';

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
        } catch (err) { setError('Failed to load data.'); }
        finally { setLoading(false); }
    };

    const loadBomPreview = async (pcbId) => {
        try {
            const res = await pcbAPI.getBom(pcbId);
            setBomPreview(res.data);
        } catch (err) { setBomPreview([]); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPcb || quantity <= 0) return;

        setError('');
        setResult(null);
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
            setError(err.response?.data?.error || 'Production entry failed.');
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
        } catch (err) { setError('Failed to load entry details.'); }
    };

    const checkStockSufficiency = (item) => {
        const needed = item.quantity_per_unit * quantity;
        return item.current_stock >= needed;
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Production Entry</h1>
                    <p className="page__subtitle">Record PCB production and deduct component stock</p>
                </div>
            </div>

            {error && <div className="alert alert--error">{error} <button onClick={() => setError('')}><X size={14} /></button></div>}

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
                            <input id="qty" type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="prod_notes">Notes (optional)</label>
                            <textarea id="prod_notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Production batch notes..." />
                        </div>

                        {bomPreview.length > 0 && (
                            <div className="bom-preview">
                                <h4>Required Components (x{quantity})</h4>
                                <table className="data-table data-table--compact">
                                    <thead>
                                        <tr><th>Component</th><th>Needed</th><th>Available</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {bomPreview.map((item, i) => {
                                            const needed = item.quantity_per_unit * quantity;
                                            const ok = checkStockSufficiency(item);
                                            return (
                                                <tr key={i}>
                                                    <td>{item.component_name}</td>
                                                    <td>{needed.toLocaleString()}</td>
                                                    <td>{item.current_stock.toLocaleString()}</td>
                                                    <td>
                                                        {ok ? (
                                                            <span className="stock-badge stock-badge--normal"><CheckCircle size={12} /> OK</span>
                                                        ) : (
                                                            <span className="stock-badge stock-badge--critical"><AlertTriangle size={12} /> Short {needed - item.current_stock}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <button type="submit" className="btn btn--primary btn--full" disabled={submitting || bomPreview.length === 0}>
                            {submitting ? <span className="btn-loading" /> : <><Factory size={16} /> Create Production Entry</>}
                        </button>
                    </form>
                </div>

                <div className="card">
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
