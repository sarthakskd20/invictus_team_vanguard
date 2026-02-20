import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CardStack } from '../components/ui/card-stack';
import { BackgroundPaths } from '../components/ui/background-paths';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/* ── Navigation items — same 6 options as the sidebar ───────────────── */
const NAV_ITEMS = [
    {
        id: 1,
        href: '/',
        title: 'Dashboard',
        description: 'Overview of KPIs, consumption trends, and live inventory health',
        tag: 'Overview',
        imageSrc: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    },
    {
        id: 2,
        href: '/inventory',
        title: 'Inventory',
        description: 'Track every component, manage stock levels and warehouse locations',
        tag: 'Stock Management',
        imageSrc: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80',
    },
    {
        id: 3,
        href: '/pcb-types',
        title: 'PCB Types',
        description: 'Manage PCB configurations, revisions and bill-of-materials',
        tag: 'Design',
        imageSrc: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
    },
    {
        id: 4,
        href: '/production',
        title: 'Production',
        description: 'Monitor assembly runs, track output and manage work orders',
        tag: 'Manufacturing',
        imageSrc: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80',
    },
    {
        id: 5,
        href: '/procurement',
        title: 'Procurement',
        description: 'Raise purchase orders, manage suppliers and incoming deliveries',
        tag: 'Supply Chain',
        imageSrc: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80',
    },
    {
        id: 6,
        href: '/reports',
        title: 'Reports',
        description: 'Export analytics, consumption history and compliance summaries',
        tag: 'Analytics',
        imageSrc: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    },
];

export default function SelectionPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeItem, setActiveItem] = useState(NAV_ITEMS[0]);

    return (
        <>
            {/* ── Background paths animation ─────────────────────── */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
                <BackgroundPaths />
            </div>

            {/* ── Fixed full-viewport layout — NO scroll ─────────────── */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 2,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
            }}>
                {/* Greeting */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '0 1rem' }}
                >
                    <p style={{
                        fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
                    }}>
                        Welcome back{user?.username ? `, ${user.username}` : ''}
                    </p>
                    <h1 style={{
                        fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700,
                        color: '#fff', margin: 0, letterSpacing: '-0.02em',
                    }}>
                        Where would you like to go?
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.32)', marginTop: 6 }}>
                        Browse with arrows · click to select · click active card to enter
                    </p>
                </motion.div>

                {/* Card Stack — full viewport width, cards bleed to edges */}
                <motion.div
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.08 }}
                    style={{ width: '100vw' }}
                >
                    <CardStack
                        items={NAV_ITEMS}
                        initialIndex={0}
                        cardWidth={520}
                        cardHeight={320}
                        overlap={0.48}
                        spreadDeg={48}
                        maxVisible={7}
                        perspectivePx={1100}
                        depthPx={140}
                        tiltXDeg={12}
                        activeLiftPx={22}
                        activeScale={1.03}
                        inactiveScale={0.94}
                        springStiffness={280}
                        springDamping={28}
                        loop
                        showDots
                        autoAdvance={false}
                        pauseOnHover
                        onChangeIndex={(_, item) => setActiveItem(item)}
                        onActivate={(item) => navigate(item.href)}
                    />
                </motion.div>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.18 }}
                    style={{ marginTop: '1.75rem', textAlign: 'center' }}
                >
                    <button
                        onClick={() => navigate(activeItem.href)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 10,
                            padding: '11px 28px', borderRadius: '50px', border: 'none',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            color: '#fff', fontSize: '0.88rem', fontWeight: 600,
                            cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.28)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 14px 32px rgba(59,130,246,0.42)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.28)';
                        }}
                    >
                        Open {activeItem.title}
                        <ArrowRight size={16} />
                    </button>
                </motion.div>
            </div>
        </>
    );
}
