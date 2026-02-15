/* eslint-disable */
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard, Package, CircuitBoard, Factory,
    ShoppingCart, FileBarChart, LogOut, Menu, X
} from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/inventory', label: 'Inventory', icon: Package },
        { path: '/pcb-types', label: 'PCB Types', icon: CircuitBoard },
        { path: '/production', label: 'Production', icon: Factory },
        { path: '/procurement', label: 'Procurement', icon: ShoppingCart },
        { path: '/reports', label: 'Reports', icon: FileBarChart },
    ];

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
            <div className="sidebar__header">
                {!collapsed && (
                    <div className="sidebar__brand">
                        <span className="sidebar__logo">IV</span>
                        <div>
                            <h1 className="sidebar__title">Invictus</h1>
                            <p className="sidebar__subtitle">Inventory System</p>
                        </div>
                    </div>
                )}
                <button className="sidebar__toggle" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <Menu size={18} /> : <X size={18} />}
                </button>
            </div>

            <nav className="sidebar__nav">
                {navItems.map(({ path, label, icon: Icon }) => (
                    <NavLink
                        key={path}
                        to={path}
                        end={path === '/'}
                        className={({ isActive }) =>
                            `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                        }
                    >
                        <Icon size={18} />
                        {!collapsed && <span>{label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                {!collapsed && user && (
                    <div className="sidebar__user">
                        <div className="sidebar__avatar">{user.username?.[0]?.toUpperCase() || 'U'}</div>
                        <div>
                            <p className="sidebar__username">{user.username}</p>
                            <p className="sidebar__role">{user.role}</p>
                        </div>
                    </div>
                )}
                <button className="sidebar__logout" onClick={handleLogout}>
                    <LogOut size={18} />
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
