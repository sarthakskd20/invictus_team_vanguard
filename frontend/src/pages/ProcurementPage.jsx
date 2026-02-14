import { useState, useEffect } from 'react';
import { procurementAPI } from '../services/api';
import { ShoppingCart, CheckCircle, Clock, X, AlertTriangle } from 'lucide-react';

export default function ProcurementPage() {
    const [triggers, setTriggers] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => { loadTriggers(); }, [filter]);

    const loadTriggers = async () => {
        try {
            const res = await procurementAPI.getAll(filter || undefined);
            setTriggers(res.data);
        } catch (err) { setError('Failed to load triggers.'); }
        finally { setLoading(false); }
    };

    const handleAcknowledge = async (id) => {
        try {
            await procurementAPI.acknowledge(id);
            setSuccess('Trigger acknowledged.');
            loadTriggers();
        } catch (err) { setError(err.response?.data?.error || 'Action failed.'); }
    };

    const handleResolve = async (id) => {
        try {
            await procurementAPI.resolve(id);
            setSuccess('Trigger resolved.');
            loadTriggers();
        } catch (err) { setError(err.response?.data?.error || 'Action failed.'); }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'PENDING': return <AlertTriangle size={14} />;
            case 'ACKNOWLEDGED': return <Clock size={14} />;
            case 'RESOLVED': return <CheckCircle size={14} />;
            default: return null;
        }
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Procurement Triggers</h1>
                    <p className="page__subtitle">Components that fell below 20% of monthly requirement</p>
                </div>
            </div>

            {error && <div className="alert alert--error">{error} <button onClick={() => setError('')}><X size={14} /></button></div>}
            {success && <div className="alert alert--success">{success} <button onClick={() => setSuccess('')}><X size={14} /></button></div>}

            <div className="toolbar">
                <div className="filter-tabs">
                    {['', 'PENDING', 'ACKNOWLEDGED', 'RESOLVED'].map(status => (
                        <button
                            key={status}
                            className={`filter-tab ${filter === status ? 'filter-tab--active' : ''}`}
                            onClick={() => setFilter(status)}
                        >
                            {status || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Component</th>
                            <th>Part Number</th>
                            <th>Category</th>
                            <th>Current Stock</th>
                            <th>Threshold</th>
                            <th>Shortage</th>
                            <th>Status</th>
                            <th>Triggered At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {triggers.map(t => (
                            <tr key={t.trigger_id}>
                                <td>{t.component_name}</td>
                                <td className="td--mono">{t.part_number}</td>
                                <td>{t.category || '—'}</td>
                                <td>{t.latest_stock}</td>
                                <td>{t.threshold_quantity}</td>
                                <td className="td--danger">{t.shortage_quantity}</td>
                                <td>
                                    <span className={`status-badge status-badge--${t.status.toLowerCase()}`}>
                                        {getStatusIcon(t.status)} {t.status}
                                    </span>
                                </td>
                                <td>{new Date(t.triggered_at).toLocaleString()}</td>
                                <td>
                                    <div className="action-btns">
                                        {t.status === 'PENDING' && (
                                            <button className="btn btn--outline btn--sm" onClick={() => handleAcknowledge(t.trigger_id)}>
                                                Acknowledge
                                            </button>
                                        )}
                                        {t.status === 'ACKNOWLEDGED' && (
                                            <button className="btn btn--primary btn--sm" onClick={() => handleResolve(t.trigger_id)}>
                                                Resolve
                                            </button>
                                        )}
                                        {t.status === 'RESOLVED' && <span className="td--muted">Done</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {triggers.length === 0 && (
                            <tr><td colSpan="9" className="td--empty">
                                {filter ? `No ${filter.toLowerCase()} triggers.` : 'No procurement triggers yet. Triggers appear when components fall below 20% threshold during production.'}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
