import { useState, useEffect, useRef } from 'react';
import { componentAPI, missingComponentsAPI } from '../services/api';
import {
    Plus, Search, Upload, Download, Edit, Trash2, X,
    ChevronLeft, ChevronRight, Filter, AlertTriangle, CheckCircle, XCircle, Package
} from 'lucide-react';

export default function InventoryPage() {
    const [components, setComponents] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [page, setPage] = useState(1);
    const fileInputRef = useRef(null);
    const schematicInputRef = useRef(null);
    const perPage = 15;

    const emptyForm = {
        component_name: '', part_number: '', current_stock: 0,
        monthly_required_quantity: 0, unit_price: 0, description: '',
        manufacturer: '', footprint: '', category: ''
    };
    const [formData, setFormData] = useState(emptyForm);

    // Schematic Preview State
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [previewSummary, setPreviewSummary] = useState({ total: 0, new: 0, existing: 0 });
    const [isSubmittingImport, setIsSubmittingImport] = useState(false);

    // Missing Components Reconciliation State
    const [reconciliationData, setReconciliationData] = useState(null);
    const [reconciliationAnalytics, setReconciliationAnalytics] = useState(null);
    const [buildQty, setBuildQty] = useState(1);
    const [isReconciling, setIsReconciling] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [isExportingReport, setIsExportingReport] = useState(false);
    const [isAddingToInventory, setIsAddingToInventory] = useState(false);

    useEffect(() => { loadData(); }, []);
    useEffect(() => { filterComponents(); }, [search, categoryFilter, components]);

    const loadData = async () => {
        try {
            const [compRes, catRes] = await Promise.all([
                componentAPI.getAll(),
                componentAPI.getCategories()
            ]);
            setComponents(compRes.data);
            setCategories(catRes.data);
        } catch (err) {
            setError('Failed to load inventory data.');
        } finally {
            setLoading(false);
        }
    };

    const filterComponents = () => {
        let result = components;
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(c =>
                c.component_name.toLowerCase().includes(s) ||
                c.part_number.toLowerCase().includes(s) ||
                (c.manufacturer && c.manufacturer.toLowerCase().includes(s))
            );
        }
        if (categoryFilter) {
            result = result.filter(c => c.category === categoryFilter);
        }
        setFiltered(result);
        setPage(1);
    };

    const paginatedData = filtered.slice((page - 1) * perPage, page * perPage);
    const totalPages = Math.ceil(filtered.length / perPage);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editItem) {
                await componentAPI.update(editItem.component_id, formData);
                setSuccess('Component updated successfully.');
            } else {
                await componentAPI.create(formData);
                setSuccess('Component added successfully.');
            }
            setShowForm(false);
            setEditItem(null);
            setFormData(emptyForm);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed.');
        }
    };

    const handleEdit = (comp) => {
        setEditItem(comp);
        setFormData({
            component_name: comp.component_name,
            part_number: comp.part_number,
            current_stock: comp.current_stock,
            monthly_required_quantity: comp.monthly_required_quantity,
            unit_price: comp.unit_price,
            description: comp.description || '',
            manufacturer: comp.manufacturer || '',
            footprint: comp.footprint || '',
            category: comp.category || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
        try {
            await componentAPI.delete(id);
            setSuccess('Component deleted.');
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Delete failed. Component may be in use by a PCB.');
        }
    };

    const handleImport = async (e, type = 'excel') => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        // Reset input
        e.target.value = '';

        try {
            setLoading(true);
            if (type === 'excel') {
                const res = await componentAPI.import(formData);
                setSuccess(res.data.message);
                loadData();
            } else {
                const res = await componentAPI.importSchematic(formData);
                const { preview } = res.data;

                // Calculate stats
                const newCount = preview.filter(p => p.status === 'new').length;
                const existCount = preview.filter(p => p.status === 'existing').length;

                setPreviewData(preview);
                setPreviewSummary({ total: preview.length, new: newCount, existing: existCount });
                setShowPreview(true);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Import failed.');
            if (err.response?.data?.details) {
                console.error('Import Details:', err.response.data.details);
            }
        } finally {
            setLoading(false);
        }
    };

    const confirmSchematicImport = async () => {
        setIsSubmittingImport(true);
        try {
            const res = await componentAPI.batchUpsertComponents(previewData);
            setSuccess(res.data.message);
            setShowPreview(false);
            setPreviewData([]);
            setReconciliationData(null);
            setReconciliationAnalytics(null);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Batch import failed.');
        } finally {
            setIsSubmittingImport(false);
        }
    };

    // ─── Reconciliation handlers ───
    const handleReconcile = async () => {
        setIsReconciling(true);
        try {
            const res = await missingComponentsAPI.reconcile(previewData, buildQty);
            setReconciliationData(res.data.reconciliation);
            setReconciliationAnalytics(res.data.analytics);
        } catch (err) {
            setError(err.response?.data?.error || 'Reconciliation failed.');
        } finally {
            setIsReconciling(false);
        }
    };

    const handleExportMissingReport = async () => {
        if (!reconciliationData) return;
        setIsExportingReport(true);
        try {
            const res = await missingComponentsAPI.exportReport(reconciliationData, reconciliationAnalytics);
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Missing_Components_Report_${Date.now()}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.response?.data?.error || 'Export failed.');
        } finally {
            setIsExportingReport(false);
        }
    };

    const handleAddMissingToInventory = async () => {
        if (!reconciliationData) return;
        const missing = reconciliationData.filter(r => r.status === 'missing');
        if (missing.length === 0) {
            setSuccess('No missing components to add.');
            return;
        }
        setIsAddingToInventory(true);
        try {
            const res = await missingComponentsAPI.addToInventory(missing);
            setSuccess(res.data.message);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add missing components.');
        } finally {
            setIsAddingToInventory(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await componentAPI.export();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `inventory_export_${Date.now()}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);
            setSuccess('Inventory exported to Excel.');
        } catch (err) {
            setError('Export failed.');
        }
    };

    const getStockStatus = (stock, monthly) => {
        if (monthly <= 0) return 'normal';
        const pct = (stock / monthly) * 100;
        if (pct < 20) return 'critical';
        if (pct < 50) return 'warning';
        return 'normal';
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Component Inventory</h1>
                    <p className="page__subtitle">{components.length} components tracked</p>
                </div>
                <div className="page__actions">
                    <input type="file" ref={fileInputRef} onChange={(e) => handleImport(e, 'excel')} accept=".xlsx,.xls,.csv" hidden />
                    <input type="file" ref={schematicInputRef} onChange={(e) => handleImport(e, 'schematic')} accept=".kicad_sch,.sch,.schdoc,.pdf,.json,.gbr,.net,.asc,.brd,.xml,.cvg,.tgz" hidden />

                    <button className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={16} /> Import Excel
                    </button>
                    <button className="btn btn--outline" onClick={() => schematicInputRef.current?.click()}>
                        <Upload size={16} /> Import Schematic
                    </button>
                    <button className="btn btn--outline" onClick={handleExport}>
                        <Download size={16} /> Export
                    </button>
                    <button className="btn btn--primary" onClick={() => { setEditItem(null); setFormData(emptyForm); setShowForm(true); }}>
                        <Plus size={16} /> Add Component
                    </button>
                </div>
            </div>

            {error && <div className="alert alert--error">{error} <button onClick={() => setError('')}><X size={14} /></button></div>}
            {success && <div className="alert alert--success">{success} <button onClick={() => setSuccess('')}><X size={14} /></button></div>}

            <div className="toolbar">
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, part number, or manufacturer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <Filter size={16} />
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Part Number</th>
                            <th>Component Name</th>
                            <th>Stock</th>
                            <th>Monthly Req.</th>
                            <th>Price</th>
                            <th>Category</th>
                            <th>Manufacturer</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map(comp => {
                            const status = getStockStatus(comp.current_stock, comp.monthly_required_quantity);
                            return (
                                <tr key={comp.component_id}>
                                    <td className="td--mono">{comp.part_number}</td>
                                    <td>{comp.component_name}</td>
                                    <td>
                                        <span className={`stock-badge stock-badge--${status}`}>
                                            {comp.current_stock.toLocaleString()}
                                        </span>
                                    </td>
                                    <td>{comp.monthly_required_quantity.toLocaleString()}</td>
                                    <td>${parseFloat(comp.unit_price).toFixed(2)}</td>
                                    <td>{comp.category || '—'}</td>
                                    <td>{comp.manufacturer || '—'}</td>
                                    <td>
                                        <div className="action-btns">
                                            <button className="icon-btn" onClick={() => handleEdit(comp)} title="Edit"><Edit size={14} /></button>
                                            <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(comp.component_id, comp.component_name)} title="Delete"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {paginatedData.length === 0 && (
                            <tr><td colSpan="8" className="td--empty">No components found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
                    <span>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
                </div>
            )}

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2>{editItem ? 'Edit Component' : 'Add Component'}</h2>
                            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal__form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="comp_name">Component Name *</label>
                                    <input id="comp_name" type="text" value={formData.component_name} onChange={e => setFormData({ ...formData, component_name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="part_num">Part Number *</label>
                                    <input id="part_num" type="text" value={formData.part_number} onChange={e => setFormData({ ...formData, part_number: e.target.value })} required />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="stock">Current Stock</label>
                                    <input id="stock" type="number" min="0" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: e.target.value === '' ? '' : parseInt(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="monthly">Monthly Required</label>
                                    <input id="monthly" type="number" min="0" value={formData.monthly_required_quantity} onChange={e => setFormData({ ...formData, monthly_required_quantity: e.target.value === '' ? '' : parseInt(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="price">Unit Price ($)</label>
                                    <input id="price" type="number" min="0" step="0.01" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="category">Category</label>
                                    <input id="category" type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. Capacitors, ICs" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="manufacturer">Manufacturer</label>
                                    <input id="manufacturer" type="text" value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="footprint">Footprint</label>
                                    <input id="footprint" type="text" value={formData.footprint} onChange={e => setFormData({ ...formData, footprint: e.target.value })} placeholder="e.g. 0402, SOT-223" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="desc">Description</label>
                                <textarea id="desc" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
                            </div>
                            <div className="modal__actions">
                                <button type="button" className="btn btn--outline" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn--primary">{editItem ? 'Save Changes' : 'Add Component'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Schematic Preview Modal */}
            {showPreview && (() => {
                const uncategorizedCount = previewData.filter(p => !p.category || p.category === 'Uncategorized').length;
                const parsedCategories = [...new Set(previewData.map(p => p.category).filter(c => c && c !== 'Uncategorized'))];
                const allCategories = [...new Set([...categories, ...parsedCategories])].sort();

                // Filter reconciliation data by status
                const displayData = reconciliationData
                    ? (statusFilter === 'all' ? reconciliationData : reconciliationData.filter(r => r.status === statusFilter))
                    : previewData;
                const isReconciled = !!reconciliationData;

                return (
                    <div className="modal-overlay">
                        <div className="modal modal--lg">
                            <div className="modal__header">
                                <h2>{isReconciled ? '🔍 BOM Reconciliation' : 'Import Preview'}</h2>
                                <button className="icon-btn" onClick={() => { setShowPreview(false); setReconciliationData(null); setReconciliationAnalytics(null); setStatusFilter('all'); }}><X size={18} /></button>
                            </div>
                            <div className="modal__content">
                                {/* Stats Summary */}
                                <div className="stats-summary" style={{ display: 'flex', gap: '1.2rem', marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {isReconciled && reconciliationAnalytics ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <CheckCircle size={16} style={{ color: '#4ade80' }} />
                                                <strong style={{ color: '#4ade80' }}>Available: {reconciliationAnalytics.availableCount}</strong>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                                                <strong style={{ color: '#f59e0b' }}>Shortage: {reconciliationAnalytics.shortageCount}</strong>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <XCircle size={16} style={{ color: '#ef4444' }} />
                                                <strong style={{ color: '#ef4444' }}>Missing: {reconciliationAnalytics.missingCount}</strong>
                                            </div>
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#aaa' }}>
                                                <span>Coverage: <strong style={{ color: reconciliationAnalytics.bomCoveragePercent >= 80 ? '#4ade80' : reconciliationAnalytics.bomCoveragePercent >= 50 ? '#f59e0b' : '#ef4444' }}>{reconciliationAnalytics.bomCoveragePercent}%</strong></span>
                                                <span>Readiness: <strong>{reconciliationAnalytics.buildReadinessScore}%</strong></span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div><strong>Total Found:</strong> {previewSummary.total}</div>
                                            <div style={{ color: '#4ade80' }}><strong>New:</strong> {previewSummary.new}</div>
                                            <div style={{ color: '#60a5fa' }}><strong>Existing:</strong> {previewSummary.existing}</div>
                                            <div><strong>Total Qty:</strong> {previewData.reduce((sum, p) => sum + (p.quantity || 1), 0)}</div>
                                        </>
                                    )}
                                </div>

                                {/* Build Qty + Reconcile controls */}
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Build Qty:</label>
                                        <input
                                            type="number" min="1" value={buildQty}
                                            onChange={e => setBuildQty(Math.max(1, parseInt(e.target.value) || 1))}
                                            style={{ width: '70px', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'inherit', textAlign: 'center' }}
                                        />
                                    </div>
                                    <button className="btn btn--primary" onClick={handleReconcile} disabled={isReconciling} style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                                        {isReconciling ? 'Reconciling...' : '🔍 Reconcile with Inventory'}
                                    </button>

                                    {isReconciled && (
                                        <>
                                            <select
                                                value={statusFilter}
                                                onChange={e => setStatusFilter(e.target.value)}
                                                style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'inherit', fontSize: '0.85rem' }}
                                            >
                                                <option value="all">All Status</option>
                                                <option value="available">✅ Available</option>
                                                <option value="shortage">⚠️ Shortage</option>
                                                <option value="missing">❌ Missing</option>
                                            </select>
                                        </>
                                    )}
                                </div>

                                {uncategorizedCount > 0 && !isReconciled && (
                                    <div style={{ padding: '0.7rem 1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', color: '#f59e0b' }}>
                                        ⚠️ {uncategorizedCount} component(s) are uncategorized. Use the dropdowns below to assign categories before confirming.
                                    </div>
                                )}

                                {/* Data Table */}
                                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Status</th>
                                                <th>Part Number</th>
                                                <th>Name</th>
                                                <th>Qty</th>
                                                {isReconciled && <th>Required</th>}
                                                {isReconciled && <th>In Stock</th>}
                                                {isReconciled && <th>Missing</th>}
                                                <th>Category</th>
                                                {isReconciled && <th>Confidence</th>}
                                                {!isReconciled && <th>Match</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayData.map((item, idx) => {
                                                const isUncategorized = !isReconciled && (!item.category || item.category === 'Uncategorized');
                                                // Row background color by status
                                                let rowStyle = isUncategorized ? { background: 'rgba(245, 158, 11, 0.06)' } : {};
                                                if (isReconciled) {
                                                    if (item.status === 'missing') rowStyle = { background: 'rgba(239, 68, 68, 0.08)' };
                                                    else if (item.status === 'shortage') rowStyle = { background: 'rgba(245, 158, 11, 0.08)' };
                                                    else if (item.status === 'available') rowStyle = { background: 'rgba(74, 222, 128, 0.06)' };
                                                }

                                                return (
                                                    <tr key={idx} style={rowStyle}>
                                                        <td>
                                                            {isReconciled ? (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.5rem',
                                                                    borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                                                                    background: item.status === 'available' ? 'rgba(74,222,128,0.15)' : item.status === 'shortage' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                                    color: item.status === 'available' ? '#4ade80' : item.status === 'shortage' ? '#f59e0b' : '#ef4444'
                                                                }}>
                                                                    {item.status === 'available' ? <CheckCircle size={12} /> : item.status === 'shortage' ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                                                                    {item.status.toUpperCase()}
                                                                </span>
                                                            ) : (
                                                                <span className={`badge ${item.status === 'new' ? 'badge--success' : 'badge--info'}`}>
                                                                    {item.status === 'new' ? 'NEW' : 'EXISTS'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="td--mono">{isReconciled ? (item.mpn || '—') : item.part_number}</td>
                                                        <td>{isReconciled ? item.value : item.component_name}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{isReconciled ? item.qtyPerPcb : (item.quantity || 1)}</td>
                                                        {isReconciled && <td style={{ textAlign: 'center' }}>{item.totalRequired}</td>}
                                                        {isReconciled && (
                                                            <td style={{ textAlign: 'center', fontWeight: 600, color: item.stockAvailable > 0 ? '#4ade80' : '#888' }}>
                                                                {item.stockAvailable}
                                                            </td>
                                                        )}
                                                        {isReconciled && (
                                                            <td style={{ textAlign: 'center', fontWeight: 700, color: item.missingQty > 0 ? '#ef4444' : '#4ade80' }}>
                                                                {item.missingQty > 0 ? item.missingQty : '✓'}
                                                            </td>
                                                        )}
                                                        <td>
                                                            {isReconciled ? (
                                                                <span style={{ fontSize: '0.85rem' }}>{item.suggestedCategory || item.componentType}</span>
                                                            ) : (
                                                                <select
                                                                    value={item.category || 'Uncategorized'}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val === '__custom__') {
                                                                            const custom = prompt('Enter custom category:');
                                                                            if (custom && custom.trim()) {
                                                                                setPreviewData(prev => prev.map((p, i) => i === idx ? { ...p, category: custom.trim() } : p));
                                                                            }
                                                                        } else {
                                                                            setPreviewData(prev => prev.map((p, i) => i === idx ? { ...p, category: val } : p));
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '0.3rem 0.5rem', borderRadius: '6px',
                                                                        border: isUncategorized ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.15)',
                                                                        background: 'rgba(255,255,255,0.05)', color: 'inherit', fontSize: '0.85rem', minWidth: '140px'
                                                                    }}
                                                                >
                                                                    <option value="Uncategorized">Uncategorized</option>
                                                                    {allCategories.map(cat => (
                                                                        <option key={cat} value={cat}>{cat}</option>
                                                                    ))}
                                                                    <option value="__custom__">+ Custom...</option>
                                                                </select>
                                                            )}
                                                        </td>
                                                        {isReconciled && (
                                                            <td style={{ fontSize: '0.8rem', color: item.matchConfidence >= 75 ? '#4ade80' : item.matchConfidence >= 50 ? '#f59e0b' : '#888' }}>
                                                                {item.matchConfidence}%
                                                            </td>
                                                        )}
                                                        {!isReconciled && (
                                                            <td style={{ fontSize: '0.85rem', color: '#888' }}>
                                                                {item.status === 'existing' ? 'Matches DB record' : 'Will be created'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Analytics / Readiness Bar (only after reconciliation) */}
                                {isReconciled && reconciliationAnalytics && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.85rem' }}>
                                            <span>Build Readiness</span>
                                            <span style={{ fontWeight: 700, color: reconciliationAnalytics.buildReadinessScore >= 80 ? '#4ade80' : reconciliationAnalytics.buildReadinessScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                                                {reconciliationAnalytics.buildReadinessScore}%
                                            </span>
                                        </div>
                                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: '4px', transition: 'width 0.5s ease',
                                                width: reconciliationAnalytics.buildReadinessScore + '%',
                                                background: reconciliationAnalytics.buildReadinessScore >= 80 ? 'linear-gradient(90deg, #4ade80, #22c55e)' : reconciliationAnalytics.buildReadinessScore >= 50 ? 'linear-gradient(90deg, #f59e0b, #eab308)' : 'linear-gradient(90deg, #ef4444, #dc2626)'
                                            }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '2rem', marginTop: '0.8rem', fontSize: '0.8rem', color: '#aaa' }}>
                                            <span>Total Required: <strong style={{ color: '#e2e8f0' }}>{reconciliationAnalytics.totalRequiredQty}</strong></span>
                                            <span>Missing Qty: <strong style={{ color: '#ef4444' }}>{reconciliationAnalytics.totalMissingQty}</strong></span>
                                            <span>Missing SKUs: <strong style={{ color: '#ef4444' }}>{reconciliationAnalytics.totalMissingSKUs}</strong></span>
                                            {reconciliationAnalytics.estimatedProcurementCost > 0 && (
                                                <span>Est. Cost: <strong style={{ color: '#60a5fa' }}>${reconciliationAnalytics.estimatedProcurementCost.toFixed(2)}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal__actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                                <button className="btn btn--outline" onClick={() => { setShowPreview(false); setReconciliationData(null); setReconciliationAnalytics(null); setStatusFilter('all'); }} disabled={isSubmittingImport}>Cancel</button>

                                {isReconciled && reconciliationAnalytics && reconciliationAnalytics.missingCount > 0 && (
                                    <>
                                        <button className="btn btn--outline" onClick={handleExportMissingReport} disabled={isExportingReport} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                                            <Download size={14} /> {isExportingReport ? 'Exporting...' : 'Export Missing Report'}
                                        </button>
                                        <button className="btn btn--outline" onClick={handleAddMissingToInventory} disabled={isAddingToInventory} style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                                            <Package size={14} /> {isAddingToInventory ? 'Adding...' : 'Add Missing to DB'}
                                        </button>
                                    </>
                                )}

                                {isReconciled && reconciliationAnalytics && reconciliationAnalytics.missingCount === 0 && reconciliationAnalytics.shortageCount > 0 && (
                                    <button className="btn btn--outline" onClick={handleExportMissingReport} disabled={isExportingReport} style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                                        <Download size={14} /> {isExportingReport ? 'Exporting...' : 'Export Shortage Report'}
                                    </button>
                                )}

                                <button className="btn btn--primary" onClick={confirmSchematicImport} disabled={isSubmittingImport}>
                                    {isSubmittingImport ? 'Importing...' : 'Confirm Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
