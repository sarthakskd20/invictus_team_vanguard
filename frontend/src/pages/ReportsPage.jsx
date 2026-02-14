import { useState, useEffect } from 'react';
import { reportAPI, componentAPI } from '../services/api';
import { Download, FileBarChart, History, X } from 'lucide-react';

export default function ReportsPage() {
    const [components, setComponents] = useState([]);
    const [selectedComponent, setSelectedComponent] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        componentAPI.getAll().then(res => setComponents(res.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (selectedComponent) loadTransactionHistory(selectedComponent);
        else setTransactions([]);
    }, [selectedComponent]);

    const loadTransactionHistory = async (componentId) => {
        setLoading(true);
        try {
            const res = await reportAPI.getTransactionHistory(componentId);
            setTransactions(res.data);
        } catch (err) { setError('Failed to load transaction history.'); }
        finally { setLoading(false); }
    };

    const downloadFile = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const handleExportInventory = async () => {
        try {
            const res = await reportAPI.exportInventory();
            downloadFile(new Blob([res.data]), `inventory_snapshot_${Date.now()}.xlsx`);
            setSuccess('Inventory snapshot exported.');
        } catch (err) { setError('Export failed.'); }
    };

    const handleExportConsumption = async () => {
        try {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            const res = await reportAPI.exportConsumption(params);
            downloadFile(new Blob([res.data]), `consumption_report_${Date.now()}.xlsx`);
            setSuccess('Consumption report exported.');
        } catch (err) { setError('Export failed.'); }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'DEDUCTION': return 'critical';
            case 'ADDITION': return 'normal';
            case 'IMPORT': return 'normal';
            case 'ADJUSTMENT': return 'warning';
            default: return '';
        }
    };

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Reports & Exports</h1>
                    <p className="page__subtitle">Export inventory data and view transaction history</p>
                </div>
            </div>

            {error && <div className="alert alert--error">{error} <button onClick={() => setError('')}><X size={14} /></button></div>}
            {success && <div className="alert alert--success">{success} <button onClick={() => setSuccess('')}><X size={14} /></button></div>}

            <div className="reports-grid">
                <div className="card">
                    <h3 className="card__title"><Download size={16} /> Export Inventory Snapshot</h3>
                    <p className="card__desc">Download the current inventory state as an Excel file including stock health percentages.</p>
                    <button className="btn btn--primary" onClick={handleExportInventory}>
                        <FileBarChart size={16} /> Export to Excel
                    </button>
                </div>

                <div className="card">
                    <h3 className="card__title"><Download size={16} /> Export Consumption Report</h3>
                    <p className="card__desc">Download stock deductions filtered by date range.</p>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="start">Start Date</label>
                            <input id="start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="end">End Date</label>
                            <input id="end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <button className="btn btn--primary" onClick={handleExportConsumption}>
                        <FileBarChart size={16} /> Export Consumption
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
                <h3 className="card__title"><History size={16} /> Component Transaction History</h3>
                <div className="form-group" style={{ maxWidth: '400px', marginBottom: '1rem' }}>
                    <label htmlFor="comp_select">Select Component</label>
                    <select id="comp_select" value={selectedComponent} onChange={e => setSelectedComponent(e.target.value)}>
                        <option value="">Choose a component...</option>
                        {components.map(c => (
                            <option key={c.component_id} value={c.component_id}>{c.component_name} ({c.part_number})</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="page-loading"><div className="loading-spinner" /></div>
                ) : transactions.length > 0 ? (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Quantity</th>
                                    <th>Before</th>
                                    <th>After</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.transaction_id}>
                                        <td>{new Date(t.created_at).toLocaleString()}</td>
                                        <td><span className={`stock-badge stock-badge--${getTypeColor(t.transaction_type)}`}>{t.transaction_type}</span></td>
                                        <td className={t.quantity_changed < 0 ? 'td--danger' : 'td--success'}>{t.quantity_changed > 0 ? '+' : ''}{t.quantity_changed}</td>
                                        <td>{t.balance_before}</td>
                                        <td>{t.balance_after}</td>
                                        <td>{t.reference_note || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : selectedComponent ? (
                    <p className="card__empty">No transactions found for this component.</p>
                ) : (
                    <p className="card__empty">Select a component to view its transaction history.</p>
                )}
            </div>
        </div>
    );
}
