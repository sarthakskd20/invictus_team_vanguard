import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar, SidebarBody, SidebarLink } from '../ui/sidebar';
import {
    LayoutDashboard, Package, CircuitBoard, Factory,
    ShoppingCart, FileBarChart, LogOut
} from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/* ── Logo (expanded) ─────────────────────────────────── */
const Logo = () => (
    <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", padding: "4px 0" }}>
        <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1,
        }}>IV</div>
        <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontWeight: 600, fontSize: "1rem", color: "var(--color-text)", whiteSpace: "nowrap" }}
        >
            Invictus
        </motion.span>
    </Link>
);

/* ── Logo (collapsed — icon only) ────────────────────── */
const LogoIcon = () => (
    <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", padding: "4px 0" }}>
        <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1,
        }}>IV</div>
    </Link>
);

/* ── Main Layout ─────────────────────────────────────── */
export default function Layout() {
    const { isAuthenticated, loading, logout, user } = useAuth();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = (e) => {
        e.preventDefault();
        logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/inventory', label: 'Inventory', icon: Package },
        { path: '/pcb-types', label: 'PCB Types', icon: CircuitBoard },
        { path: '/production', label: 'Production', icon: Factory },
        { path: '/procurement', label: 'Procurement', icon: ShoppingCart },
        { path: '/reports', label: 'Reports', icon: FileBarChart },
    ];

    return (
        <div style={{
            display: "flex",
            flexDirection: "row",
            height: "100vh",
            width: "100%",
            overflow: "hidden",
            background: "var(--color-bg)",
        }}>
            {/* ── Sidebar ──────────────────────────────── */}
            <Sidebar open={open} setOpen={setOpen}>
                <SidebarBody style={{ justifyContent: "space-between", gap: 40 }}>
                    {/* Top section: Logo + Nav */}
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                        {open ? <Logo /> : <LogoIcon />}

                        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 4 }}>
                            {navItems.map((item, idx) => (
                                <SidebarLink key={idx} link={{
                                    label: item.label,
                                    href: item.path,
                                    icon: <item.icon size={18} style={{ color: "var(--color-text-secondary)" }} />,
                                }} />
                            ))}
                        </div>
                    </div>

                    {/* Bottom section: User + Logout */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
                        {user && (
                            <SidebarLink link={{
                                label: user.username,
                                href: "#",
                                icon: (
                                    <div style={{
                                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                        background: "var(--color-primary-dim)", color: "var(--color-primary)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 11, fontWeight: 600,
                                    }}>
                                        {user.username?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                ),
                            }} />
                        )}
                        <SidebarLink
                            link={{
                                label: "Sign Out",
                                href: "#",
                                icon: <LogOut size={18} style={{ color: "var(--color-text-secondary)" }} />,
                            }}
                            onClick={handleLogout}
                        />
                    </div>
                </SidebarBody>
            </Sidebar>

            {/* ── Main Content ─────────────────────────── */}
            <main style={{
                flex: 1,
                overflowY: "auto",
                minHeight: "100vh",
            }}>
                <Outlet />
            </main>
        </div>
    );
}
