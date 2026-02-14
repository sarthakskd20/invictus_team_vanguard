import { useState, useEffect, useRef } from 'react';
import { componentAPI } from '../services/api';
import {
    Plus, Search, Upload, Download, Edit, Trash2, X,
    ChevronLeft, ChevronRight, Filter
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
    const perPage = 15;

    const emptyForm = {
        component_name: '', part_number: '', current_stock: 0,
        monthly_required_quantity: 0, unit_price: 0, description: '',
        manufacturer: '', footprint: '', category: ''
    };
    const [formData, setFormData] = useState(emptyForm);

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

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            setLoading(true);
            const res = await componentAPI.import(formData);
            setSuccess(res.data.message);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Import failed.');
        } finally {
            setLoading(false);
            e.target.value = '';
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
                    <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls,.csv" hidden />
                    <button className="btn btn--outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={16} /> Import
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
                                    <input id="stock" type="number" min="0" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="monthly">Monthly Required</label>
                                    <input id="monthly" type="number" min="0" value={formData.monthly_required_quantity} onChange={e => setFormData({ ...formData, monthly_required_quantity: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="price">Unit Price ($)</label>
                                    <input id="price" type="number" min="0" step="0.01" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} />
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
        </div>
    );
}
