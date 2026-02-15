import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

/* ── Context ─────────────────────────────────────────── */
const SidebarContext = createContext(undefined);

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
                borderRight: "1px solid var(--color-border)",
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

    return (
        <Link
            to={link.href}
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 450,
                transition: "background 150ms ease, color 150ms ease",
                whiteSpace: "nowrap",
                overflow: "hidden",
                ...extraStyle,
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = "var(--color-surface-raised)";
                e.currentTarget.style.color = "var(--color-text)";
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
        >
            <span style={{ flexShrink: 0, display: "flex" }}>{link.icon}</span>
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
