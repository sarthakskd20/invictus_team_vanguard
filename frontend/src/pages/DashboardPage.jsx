import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Package, CircuitBoard, AlertTriangle, DollarSign,
    Factory, ShoppingCart, TrendingDown, BarChart3
} from 'lucide-react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

export default function DashboardPage() {
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [lowStock, setLowStock] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [consumptionTrend, setConsumptionTrend] = useState([]);
    const [productionByPCB, setProductionByPCB] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [sumRes, lowRes, catRes, trendRes, pcbRes] = await Promise.all([
                dashboardAPI.getSummary(),
                dashboardAPI.getLowStock(),
                dashboardAPI.getStockByCategory(),
                dashboardAPI.getConsumptionTrend(14),
                dashboardAPI.getProductionByPCB()
            ]);
            setSummary(sumRes.data);
            setLowStock(lowRes.data);
            setCategoryData(catRes.data);
            setConsumptionTrend(trendRes.data);
            setProductionByPCB(pcbRes.data);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="loading-spinner" /></div>;
    }

    const statCards = summary ? [
        { label: 'Total Components', value: summary.total_components, icon: Package, color: '#3b82f6' },
        { label: 'PCB Types', value: summary.total_pcb_types, icon: CircuitBoard, color: '#8b5cf6' },
        { label: 'Low Stock Alerts', value: summary.low_stock_count, icon: AlertTriangle, color: summary.low_stock_count > 0 ? '#ef4444' : '#22c55e' },
        { label: 'Inventory Value', value: `$${summary.total_inventory_value.toLocaleString()}`, icon: DollarSign, color: '#f59e0b' },
        { label: 'Production (30d)', value: summary.production_last_30_days, icon: Factory, color: '#06b6d4' },
        { label: 'Pending Triggers', value: summary.pending_procurement_triggers, icon: ShoppingCart, color: summary.pending_procurement_triggers > 0 ? '#f97316' : '#22c55e' }
    ] : [];

    const chartColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#22c55e', '#ec4899', '#f97316'];

    const categoryChartData = {
        labels: categoryData.map(c => c.category),
        datasets: [{
            data: categoryData.map(c => parseInt(c.total_stock)),
            backgroundColor: chartColors.slice(0, categoryData.length),
            borderWidth: 0
        }]
    };

    const consumptionChartData = {
        labels: consumptionTrend.map(c => new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
            label: 'Components Used',
            data: consumptionTrend.map(c => parseInt(c.total_consumed)),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#3b82f6'
        }]
    };

    const productionChartData = {
        labels: productionByPCB.map(p => p.pcb_name),
        datasets: [{
            label: 'Units Produced',
            data: productionByPCB.map(p => parseInt(p.total_produced)),
            backgroundColor: chartColors.slice(0, productionByPCB.length),
            borderRadius: 6,
            barThickness: 32
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 } } },
            y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 11 } } }
        }
    };

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <h1 className="page__title">Dashboard</h1>
                    <p className="page__subtitle">Welcome back, {user?.username}</p>
                </div>
            </div>

            <div className="stats-grid">
                {statCards.map((card, i) => (
                    <div key={i} className="stat-card">
                        <div className="stat-card__icon" style={{ color: card.color, background: `${card.color}15` }}>
                            <card.icon size={20} />
                        </div>
                        <div>
                            <p className="stat-card__label">{card.label}</p>
                            <p className="stat-card__value">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid">
                <div className="card chart-card">
                    <h3 className="card__title">
                        <TrendingDown size={16} /> Consumption Trend (14 Days)
                    </h3>
                    <div className="chart-container">
                        {consumptionTrend.length > 0 ? (
                            <Line data={consumptionChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
                        ) : (
                            <p className="chart-empty">No consumption data available yet</p>
                        )}
                    </div>
                </div>

                <div className="card chart-card">
                    <h3 className="card__title">
                        <BarChart3 size={16} /> Production by PCB (30 Days)
                    </h3>
                    <div className="chart-container">
                        {productionByPCB.length > 0 ? (
                            <Bar data={productionChartData} options={chartOptions} />
                        ) : (
                            <p className="chart-empty">No production data available yet</p>
                        )}
                    </div>
                </div>

                <div className="card chart-card chart-card--small">
                    <h3 className="card__title">Stock by Category</h3>
                    <div className="chart-container chart-container--doughnut">
                        {categoryData.length > 0 ? (
                            <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a1a1aa', padding: 12, font: { size: 11 } } } }, cutout: '65%' }} />
                        ) : (
                            <p className="chart-empty">No category data</p>
                        )}
                    </div>
                </div>

                <div className="card">
                    <h3 className="card__title">
                        <AlertTriangle size={16} /> Low Stock Alerts
                    </h3>
                    {lowStock.length > 0 ? (
                        <div className="alert-list">
                            {lowStock.slice(0, 6).map((item) => (
                                <div key={item.component_id} className="alert-item">
                                    <div>
                                        <p className="alert-item__name">{item.component_name}</p>
                                        <p className="alert-item__part">{item.part_number}</p>
                                    </div>
                                    <div className="alert-item__stock">
                                        <span className="stock-badge stock-badge--critical">{item.current_stock} left</span>
                                        <span className="alert-item__pct">{item.stock_percentage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="card__empty">All components are stocked above 20% threshold.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
