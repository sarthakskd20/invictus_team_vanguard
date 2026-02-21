import { useState, useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Package, CircuitBoard, AlertTriangle, DollarSign,
    Factory, ShoppingCart, TrendingDown, BarChart3
} from 'lucide-react';
import { GlowingEffect } from '../components/ui/glowing-effect';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

/* ────────────────────────────────────────────
   Animated counter hook — counts from 0 to end
   ──────────────────────────────────────────── */
function useAnimatedCounter(end, duration = 800, shouldAnimate = true) {
    const [count, setCount] = useState(0);
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!shouldAnimate || hasAnimated.current) return;
        if (typeof end !== 'number' || isNaN(end)) {
            setCount(end);
            return;
        }
        hasAnimated.current = true;
        const startTime = performance.now();
        const step = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [end, duration, shouldAnimate]);

    return count;
}

/* ────────────────────────────────────────────
   Individual animated stat card
   ──────────────────────────────────────────── */
function AnimatedStatCard({ card, index }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-40px' });

    // Determine if value is numeric for counter animation
    const isNumeric = typeof card.value === 'number';
    const animatedValue = useAnimatedCounter(
        isNumeric ? card.value : 0,
        800,
        isInView && isNumeric
    );
    const displayValue = isNumeric ? animatedValue : card.value;

    return (
        <motion.div
            ref={ref}
            className="stat-card"
            style={{ '--stat-accent': card.color }}
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{
                duration: 0.45,
                delay: index * 0.07,
                ease: [0.22, 1, 0.36, 1]
            }}
        >
            <GlowingEffect
                spread={40} glow disabled={false}
                proximity={64} inactiveZone={0.01} borderWidth={2}
            />
            <div
                className="stat-card__icon"
                style={{
                    color: card.color,
                    background: `${card.color}15`
                }}
            >
                <card.icon size={20} />
            </div>
            <div>
                <p className="stat-card__label">{card.label}</p>
                <p className="stat-card__value">{displayValue}</p>
            </div>
        </motion.div>
    );
}

/* ────────────────────────────────────────────
   Scroll-reveal wrapper for chart cards
   ──────────────────────────────────────────── */
function RevealCard({ children, delay = 0 }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-60px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 32 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
            transition={{
                duration: 0.55,
                delay,
                ease: [0.22, 1, 0.36, 1]
            }}
        >
            {children}
        </motion.div>
    );
}

/* ────────────────────────────────────────────
   Dashboard page
   ──────────────────────────────────────────── */
export default function DashboardPage() {
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [lowStock, setLowStock] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [consumptionTrend, setConsumptionTrend] = useState([]);
    const [productionByPCB, setProductionByPCB] = useState([]);
    const [loading, setLoading] = useState(true);

    // Parallax for the header
    const headerRef = useRef(null);
    const { scrollY } = useScroll();
    const headerY = useTransform(scrollY, [0, 200], [0, -18]);
    const headerOpacity = useTransform(scrollY, [0, 160], [1, 0.85]);

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
        { label: 'Low Stock Alerts', value: summary.low_stock_count, icon: AlertTriangle, color: summary.low_stock_count > 0 ? '#f87171' : '#34d399' },
        { label: 'Inventory Value', value: `$${summary.total_inventory_value.toLocaleString()}`, icon: DollarSign, color: '#fbbf24' },
        { label: 'Production (30d)', value: summary.production_last_30_days, icon: Factory, color: '#67e8f9' },
        { label: 'Pending Triggers', value: summary.pending_procurement_triggers, icon: ShoppingCart, color: summary.pending_procurement_triggers > 0 ? '#fb923c' : '#34d399' }
    ] : [];

    const chartColors = ['#8b7cf6', '#a78bfa', '#67e8f9', '#fbbf24', '#f87171', '#34d399', '#f472b6', '#fb923c'];

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
            borderColor: '#8b7cf6',
            backgroundColor: (ctx) => {
                if (!ctx.chart.chartArea) return 'rgba(139, 124, 246, 0.08)';
                const gradient = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
                gradient.addColorStop(0, 'rgba(139, 124, 246, 0.22)');
                gradient.addColorStop(1, 'rgba(139, 124, 246, 0.0)');
                return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#8b7cf6',
            pointBorderColor: '#0d0c14',
            pointBorderWidth: 2,
            borderWidth: 2
        }]
    };

    const productionChartData = {
        labels: productionByPCB.map(p => p.pcb_name),
        datasets: [{
            label: 'Units Produced',
            data: productionByPCB.map(p => parseInt(p.total_produced)),
            backgroundColor: chartColors.slice(0, productionByPCB.length).map(c => c + 'cc'),
            hoverBackgroundColor: chartColors.slice(0, productionByPCB.length),
            borderRadius: 8,
            barThickness: 32,
            borderSkipped: false
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(20, 19, 29, 0.94)',
                borderColor: 'rgba(139, 124, 246, 0.12)',
                borderWidth: 1,
                titleFont: { family: "'Inter', sans-serif", size: 12, weight: 600 },
                bodyFont: { family: "'Inter', sans-serif", size: 11 },
                padding: 10,
                cornerRadius: 10,
                titleColor: '#e8e6ef',
                bodyColor: '#a5a2b3'
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#6e6b7f', font: { size: 11, family: "'Inter', sans-serif" } },
                border: { display: false }
            },
            y: {
                grid: { color: 'rgba(139, 124, 246, 0.05)', lineWidth: 1 },
                ticks: { color: '#6e6b7f', font: { size: 11, family: "'Inter', sans-serif" } },
                border: { display: false }
            }
        }
    };

    return (
        <div className="page" style={{ position: 'relative', zIndex: 1 }}>

            {/* Parallax header */}
            <motion.div
                ref={headerRef}
                className="page__header"
                style={{ y: headerY, opacity: headerOpacity }}
            >
                <div>
                    <h1 className="page__title">Dashboard</h1>
                    <p className="page__subtitle">Welcome back, {user?.username}</p>
                </div>
            </motion.div>

            {/* Stat cards with staggered reveal + animated counters */}
            <div className="stats-grid">
                {statCards.map((card, i) => (
                    <AnimatedStatCard key={i} card={card} index={i} />
                ))}
            </div>

            {/* Chart cards with scroll reveal */}
            <div className="dashboard-grid">
                <RevealCard delay={0}>
                    <div className="card chart-card">
                        <GlowingEffect
                            spread={40} glow disabled={false}
                            proximity={64} inactiveZone={0.01} borderWidth={2}
                        />
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
                </RevealCard>

                <RevealCard delay={0.08}>
                    <div className="card chart-card">
                        <GlowingEffect
                            spread={40} glow disabled={false}
                            proximity={64} inactiveZone={0.01} borderWidth={2}
                        />
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
                </RevealCard>

                <RevealCard delay={0.04}>
                    <div className="card chart-card chart-card--small">
                        <GlowingEffect
                            spread={40} glow disabled={false}
                            proximity={64} inactiveZone={0.01} borderWidth={2}
                        />
                        <h3 className="card__title">Stock by Category</h3>
                        <div className="chart-container chart-container--doughnut">
                            {categoryData.length > 0 ? (
                                <Doughnut data={categoryChartData} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'bottom',
                                            labels: {
                                                color: '#a1a1aa',
                                                padding: 12,
                                                font: { size: 11, family: "'Inter', sans-serif" },
                                                usePointStyle: true,
                                                pointStyle: 'circle'
                                            }
                                        },
                                        tooltip: chartOptions.plugins.tooltip
                                    },
                                    cutout: '68%'
                                }} />
                            ) : (
                                <p className="chart-empty">No category data</p>
                            )}
                        </div>
                    </div>
                </RevealCard>

                <RevealCard delay={0.12}>
                    <div className="card">
                        <GlowingEffect
                            spread={40} glow disabled={false}
                            proximity={64} inactiveZone={0.01} borderWidth={2}
                        />
                        <h3 className="card__title">
                            <AlertTriangle size={16} /> Low Stock Alerts
                        </h3>
                        {lowStock.length > 0 ? (
                            <div className="alert-list">
                                {lowStock.slice(0, 6).map((item, idx) => (
                                    <motion.div
                                        key={item.component_id}
                                        className="alert-item"
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3, delay: 0.15 + idx * 0.05 }}
                                    >
                                        <div>
                                            <p className="alert-item__name">{item.component_name}</p>
                                            <p className="alert-item__part">{item.part_number}</p>
                                        </div>
                                        <div className="alert-item__stock">
                                            <span className="stock-badge stock-badge--critical">{item.current_stock} left</span>
                                            <span className="alert-item__pct">{item.stock_percentage}%</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <p className="card__empty">All components are stocked above 20% threshold.</p>
                        )}
                    </div>
                </RevealCard>
            </div>
        </div>
    );
}
