import { useState, useEffect } from 'react';
import { pcbAPI, componentAPI } from '../services/api';
import { Plus, Edit, Trash2, X, CircuitBoard, ChevronDown, ChevronUp } from 'lucide-react';

export default function PCBTypesPage() {
    const [pcbs, setPcbs] = useState([]);
    const [components, setComponents] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [expandedBom, setExpandedBom] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const emptyForm = { pcb_name: '', pcb_code: '', description: '', bom: [] };
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [pcbRes, compRes] = await Promise.all([pcbAPI.getAll(), componentAPI.getAll()]);
            setPcbs(pcbRes.data);
            setComponents(compRes.data);
        } catch { setError('Failed to load data.'); }
        finally { setLoading(false); }
    };

    const toggleExpand = async (pcbId) => {
        if (expandedId === pcbId) { setExpandedId(null); return; }
        try {
            const res = await pcbAPI.getBom(pcbId);
            setExpandedBom(res.data);
            setExpandedId(pcbId);
        } catch { setError('Failed to load BOM.'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (editItem) {
                await pcbAPI.update(editItem.pcb_id, formData);
                setSuccess('PCB type updated.');
            } else {
                await pcbAPI.create(formData);
                setSuccess('PCB type created.');
            }
            setShowForm(false);
            setEditItem(null);
            setFormData(emptyForm);
            loadData();
        } catch (err) { setError(err.response?.data?.error || 'Operation failed.'); }
    };

    const handleEdit = async (pcb) => {
        try {
            const res = await pcbAPI.getById(pcb.pcb_id);
            setEditItem(res.data);
            setFormData({
                pcb_name: res.data.pcb_name,
                pcb_code: res.data.pcb_code,
                description: res.data.description || '',
                bom: res.data.bom.map(b => ({ component_id: b.component_id, quantity_per_unit: b.quantity_per_unit }))
            });
            setShowForm(true);
        } catch { setError('Failed to load PCB details.'); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? All BOM mappings will be removed.`)) return;
        try {
            await pcbAPI.delete(id);
            setSuccess('PCB type deleted.');
            loadData();
        } catch (err) { setError(err.response?.data?.error || 'Delete failed.'); }
    };

    const addBomRow = () => {
        setFormData({ ...formData, bom: [...formData.bom, { component_id: '', quantity_per_unit: 1 }] });
    };

    const removeBomRow = (index) => {
        setFormData({ ...formData, bom: formData.bom.filter((_, i) => i !== index) });
    };

    const updateBomRow = (index, field, value) => {
        const newBom = [...formData.bom];
        newBom[index] = { ...newBom[index], [field]: field === 'quantity_per_unit' ? (value === '' ? '' : parseInt(value)) : value };
        setFormData({ ...formData, bom: newBom });
    };

    if (loading) return <div className="page-loading"><div className="loading-spinner" /></div>;

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">PCB Types</h1>
                    <p className="page__subtitle">{pcbs.length} PCB types with BOM mappings</p>
                </div>
                <button className="btn btn--primary" onClick={() => { setEditItem(null); setFormData(emptyForm); setShowForm(true); }}>
                    <Plus size={16} /> New PCB Type
                </button>
            </div>

            {error && <div className="alert alert--error">{error} <button onClick={() => setError('')}><X size={14} /></button></div>}
            {success && <div className="alert alert--success">{success} <button onClick={() => setSuccess('')}><X size={14} /></button></div>}

            <div className="pcb-list">
                {pcbs.map(pcb => (
                    <div key={pcb.pcb_id} className="pcb-card">
                        <div className="pcb-card__header" onClick={() => toggleExpand(pcb.pcb_id)}>
                            <div className="pcb-card__info">
                                <CircuitBoard size={20} className="pcb-card__icon" />
                                <div>
                                    <h3 className="pcb-card__name">{pcb.pcb_name}</h3>
                                    <p className="pcb-card__code">{pcb.pcb_code}</p>
                                </div>
                            </div>
                            <div className="pcb-card__meta">
                                <span className="badge">{pcb.component_count} components</span>
                                <span className="badge badge--secondary">{pcb.production_count} produced</span>
                                <div className="action-btns">
                                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleEdit(pcb); }}><Edit size={14} /></button>
                                    <button className="icon-btn icon-btn--danger" onClick={(e) => { e.stopPropagation(); handleDelete(pcb.pcb_id, pcb.pcb_name); }}><Trash2 size={14} /></button>
                                </div>
                                {expandedId === pcb.pcb_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>
                        {expandedId === pcb.pcb_id && (
                            <div className="pcb-card__bom">
                                <table className="data-table data-table--compact">
                                    <thead>
                                        <tr>
                                            <th>Component</th>
                                            <th>Part Number</th>
                                            <th>Qty / Unit</th>
                                            <th>Available Stock</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expandedBom.map((item, i) => {
                                            const sufficient = item.current_stock >= item.quantity_per_unit;
                                            return (
                                                <tr key={i}>
                                                    <td>{item.component_name}</td>
                                                    <td className="td--mono">{item.part_number}</td>
                                                    <td>{item.quantity_per_unit}</td>
                                                    <td>{item.current_stock.toLocaleString()}</td>
                                                    <td><span className={`stock-badge stock-badge--${sufficient ? 'normal' : 'critical'}`}>{sufficient ? 'OK' : 'Low'}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
                {pcbs.length === 0 && <p className="card__empty">No PCB types created yet.</p>}
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2>{editItem ? 'Edit PCB Type' : 'Create PCB Type'}</h2>
                            <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal__form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="pcb_name">PCB Name *</label>
                                    <input id="pcb_name" type="text" value={formData.pcb_name} onChange={e => setFormData({ ...formData, pcb_name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="pcb_code">PCB Code *</label>
                                    <input id="pcb_code" type="text" value={formData.pcb_code} onChange={e => setFormData({ ...formData, pcb_code: e.target.value })} required placeholder="e.g. PCB-001" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="pcb_desc">Description</label>
                                <textarea id="pcb_desc" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
                            </div>

                            <div className="bom-builder">
                                <div className="bom-builder__header">
                                    <h3>Bill of Materials</h3>
                                    <button type="button" className="btn btn--outline btn--sm" onClick={addBomRow}><Plus size={14} /> Add Component</button>
                                </div>
                                {formData.bom.length > 0 ? (
                                    <table className="data-table data-table--compact">
                                        <thead>
                                            <tr>
                                                <th>Component</th>
                                                <th>Quantity per Unit</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.bom.map((row, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <select value={row.component_id} onChange={e => updateBomRow(i, 'component_id', e.target.value)} required>
                                                            <option value="">Select component...</option>
                                                            {components.map(c => (
                                                                <option key={c.component_id} value={c.component_id}>
                                                                    {c.component_name} ({c.part_number})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input type="number" min="1" value={row.quantity_per_unit} onChange={e => updateBomRow(i, 'quantity_per_unit', e.target.value)} style={{ width: '80px' }} />
                                                    </td>
                                                    <td>
                                                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeBomRow(i)}><Trash2 size={14} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="bom-builder__empty">No components added to BOM yet.</p>
                                )}
                            </div>

                            <div className="modal__actions">
                                <button type="button" className="btn btn--outline" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn--primary">{editItem ? 'Save Changes' : 'Create PCB Type'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
