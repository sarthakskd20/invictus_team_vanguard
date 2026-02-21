import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion"; // eslint-disable-line no-unused-vars
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

/* ── Context ─────────────────────────────────────────── */
const SidebarContext = createContext(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};

export const SidebarProvider = ({
    children,
    open: openProp,
    setOpen: setOpenProp,
    animate = true,
}) => {
    const [openState, setOpenState] = useState(false);
    const open = openProp !== undefined ? openProp : openState;
    const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

    return (
        <SidebarContext.Provider value={{ open, setOpen, animate }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const Sidebar = ({ children, open, setOpen, animate }) => (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
        {children}
    </SidebarProvider>
);

/* ── SidebarBody renders Desktop + Mobile ────────────── */
export const SidebarBody = ({ children, style, ...props }) => (
    <>
        <DesktopSidebar style={style} {...props}>{children}</DesktopSidebar>
        <MobileSidebar>{children}</MobileSidebar>
    </>
);

/* ── Desktop Sidebar ─────────────────────────────────── */
const EXPANDED = 260;
const COLLAPSED = 64;

export const DesktopSidebar = ({ children, style, ...props }) => {
    const { open, setOpen, animate } = useSidebar();

    return (
        <motion.div
            animate={{ width: animate ? (open ? EXPANDED : COLLAPSED) : EXPANDED }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            style={{
                height: "100%",
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                background: "var(--color-surface)",
                borderRight: "1px solid rgba(139, 124, 246, 0.08)",
                overflow: "hidden",
                ...style,
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
};

/* ── Mobile Sidebar ──────────────────────────────────── */
export const MobileSidebar = ({ children }) => {
    const { open, setOpen } = useSidebar();

    return (
        <div
            style={{
                display: "none", // hidden on desktop — override below
                padding: "10px 16px",
                background: "var(--color-surface)",
                borderBottom: "1px solid var(--color-border)",
                position: "relative",
                zIndex: 50,
            }}
            className="mobile-sidebar-toggle"
        >
            <Menu
                size={20}
                style={{ color: "var(--color-text)", cursor: "pointer" }}
                onClick={() => setOpen(!open)}
            />

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "-100%", opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 100,
                            background: "var(--color-surface)",
                            padding: "24px 16px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: 16,
                                right: 16,
                                cursor: "pointer",
                                color: "var(--color-text)",
                            }}
                            onClick={() => setOpen(false)}
                        >
                            <X size={20} />
                        </div>
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/* ── SidebarLink ─────────────────────────────────────── */
export const SidebarLink = ({ link, onClick, style: extraStyle }) => {
    const { open, animate } = useSidebar();

    // Detect active route
    const isActive = typeof window !== 'undefined' &&
        (link.href === '/' ? window.location.pathname === '/' : window.location.pathname.startsWith(link.href));

    return (
        <Link
            to={link.href}
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 14px",
                borderRadius: 12,
                color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: isActive ? 550 : 450,
                letterSpacing: "0.01em",
                transition: "all 250ms cubic-bezier(0.22, 1, 0.36, 1)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                background: isActive ? "rgba(139, 124, 246, 0.1)" : "transparent",
                borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                position: "relative",
                ...extraStyle,
            }}
            onMouseEnter={e => {
                if (!isActive) {
                    e.currentTarget.style.background = "rgba(139, 124, 246, 0.06)";
                    e.currentTarget.style.color = "var(--color-text)";
                    e.currentTarget.style.transform = "translateX(2px)";
                }
            }}
            onMouseLeave={e => {
                if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--color-text-secondary)";
                    e.currentTarget.style.transform = "translateX(0)";
                }
            }}
        >
            <span style={{
                flexShrink: 0,
                display: "flex",
                transition: "transform 200ms ease",
            }}>{link.icon}</span>
            <motion.span
                animate={{
                    display: animate ? (open ? "inline-block" : "none") : "inline-block",
                    opacity: animate ? (open ? 1 : 0) : 1,
                }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
            >
                {link.label}
            </motion.span>
        </Link>
    );
};
