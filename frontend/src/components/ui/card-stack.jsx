import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, SquareArrowOutUpRight } from "lucide-react";
import { Link } from "react-router-dom";

function wrapIndex(n, len) {
    if (len <= 0) return 0;
    return ((n % len) + len) % len;
}

function signedOffset(i, active, len, loop) {
    const raw = i - active;
    if (!loop || len <= 1) return raw;
    const alt = raw > 0 ? raw - len : raw + len;
    return Math.abs(alt) < Math.abs(raw) ? alt : raw;
}

export function CardStack({
    items,
    initialIndex = 0,
    maxVisible = 7,
    cardWidth = 520,
    cardHeight = 320,
    overlap = 0.48,
    spreadDeg = 48,
    perspectivePx = 1100,
    depthPx = 140,
    tiltXDeg = 12,
    activeLiftPx = 22,
    activeScale = 1.03,
    inactiveScale = 0.94,
    springStiffness = 280,
    springDamping = 28,
    loop = true,
    autoAdvance = false,
    intervalMs = 2800,
    pauseOnHover = true,
    showDots = true,
    className,
    onChangeIndex,
    onActivate,
    renderCard,
}) {
    const reduceMotion = useReducedMotion();
    const len = items.length;

    const [active, setActive] = React.useState(() => wrapIndex(initialIndex, len));
    const [hovering, setHovering] = React.useState(false);

    React.useEffect(() => {
        setActive((a) => wrapIndex(a, len));
    }, [len]);

    React.useEffect(() => {
        if (!len) return;
        onChangeIndex?.(active, items[active]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const maxOffset = Math.max(0, Math.floor(maxVisible / 2));
    const cardSpacing = Math.max(10, Math.round(cardWidth * (1 - overlap)));
    const stepDeg = maxOffset > 0 ? spreadDeg / maxOffset : 0;

    const canGoPrev = loop || active > 0;
    const canGoNext = loop || active < len - 1;

    const prev = React.useCallback(() => {
        if (!len || !canGoPrev) return;
        setActive((a) => wrapIndex(a - 1, len));
    }, [canGoPrev, len]);

    const next = React.useCallback(() => {
        if (!len || !canGoNext) return;
        setActive((a) => wrapIndex(a + 1, len));
    }, [canGoNext, len]);

    const onKeyDown = (e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        if (e.key === "Enter" && onActivate) { e.preventDefault(); onActivate(items[active]); }
    };

    React.useEffect(() => {
        if (!autoAdvance || reduceMotion || !len) return;
        if (pauseOnHover && hovering) return;
        const id = window.setInterval(() => {
            if (loop || active < len - 1) next();
        }, Math.max(700, intervalMs));
        return () => window.clearInterval(id);
    }, [autoAdvance, intervalMs, hovering, pauseOnHover, reduceMotion, len, loop, active, next]);

    if (!len) return null;

    const activeItem = items[active];

    return (
        <div
            style={{ width: "100%" }}
            className={className}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            {/* ── Stage ───────────────────────────────────────────────── */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: Math.max(380, cardHeight + 80),
                    outline: "none",
                }}
                tabIndex={0}
                onKeyDown={onKeyDown}
            >
                {/* Glow washes */}
                <div style={{
                    pointerEvents: "none", position: "absolute",
                    left: "15%", right: "15%", top: 24, height: 192,
                    borderRadius: "50%", background: "rgba(139,124,246,0.04)", filter: "blur(50px)",
                }} aria-hidden="true" />
                <div style={{
                    pointerEvents: "none", position: "absolute",
                    left: "12%", right: "12%", bottom: 0, height: 160,
                    borderRadius: "50%", background: "rgba(0,0,0,0.25)", filter: "blur(40px)",
                }} aria-hidden="true" />

                {/* ── Left arrow ──────────────────────────────────────── */}
                <button
                    onClick={prev}
                    aria-label="Previous"
                    style={{
                        position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
                        zIndex: 200,
                        background: "rgba(20,19,29,0.7)", border: "1px solid rgba(139,124,246,0.15)",
                        borderRadius: "50%", width: 44, height: 44,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: canGoPrev ? "pointer" : "not-allowed",
                        opacity: canGoPrev ? 1 : 0.25, color: "#e8e6ef",
                        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        transition: "all 250ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => { if (canGoPrev) { e.currentTarget.style.background = "rgba(139,124,246,0.15)"; e.currentTarget.style.borderColor = "rgba(139,124,246,0.3)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,19,29,0.7)"; e.currentTarget.style.borderColor = "rgba(139,124,246,0.15)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
                >
                    <ChevronLeft size={18} />
                </button>

                {/* ── Right arrow ─────────────────────────────────────── */}
                <button
                    onClick={next}
                    aria-label="Next"
                    style={{
                        position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
                        zIndex: 200,
                        background: "rgba(20,19,29,0.7)", border: "1px solid rgba(139,124,246,0.15)",
                        borderRadius: "50%", width: 44, height: 44,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: canGoNext ? "pointer" : "not-allowed",
                        opacity: canGoNext ? 1 : 0.25, color: "#e8e6ef",
                        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                        transition: "all 250ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    onMouseEnter={(e) => { if (canGoNext) { e.currentTarget.style.background = "rgba(139,124,246,0.15)"; e.currentTarget.style.borderColor = "rgba(139,124,246,0.3)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,19,29,0.7)"; e.currentTarget.style.borderColor = "rgba(139,124,246,0.15)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
                >
                    <ChevronRight size={18} />
                </button>

                {/* ── Fan ─────────────────────────────────────────────── */}
                <div
                    style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "flex-end", justifyContent: "center",
                        perspective: `${perspectivePx}px`,
                    }}
                >
                    <AnimatePresence initial={false}>
                        {items.map((item, i) => {
                            const off = signedOffset(i, active, len, loop);
                            const abs = Math.abs(off);
                            if (abs > maxOffset) return null;

                            const rotateZ = off * stepDeg;
                            const x = off * cardSpacing;
                            const y = abs * 10;
                            const z = -abs * depthPx;
                            const isActive = off === 0;
                            const scale = isActive ? activeScale : inactiveScale;
                            const lift = isActive ? -activeLiftPx : 0;
                            const rotateX = isActive ? 0 : tiltXDeg;
                            const zIndex = 100 - abs;

                            const dragProps = isActive
                                ? {
                                    drag: "x",
                                    dragConstraints: { left: 0, right: 0 },
                                    dragElastic: 0.18,
                                    onDragEnd: (_e, info) => {
                                        if (reduceMotion) return;
                                        const threshold = Math.min(160, cardWidth * 0.22);
                                        if (info.offset.x > threshold || info.velocity.x > 650) prev();
                                        else if (info.offset.x < -threshold || info.velocity.x < -650) next();
                                    },
                                }
                                : {};

                            return (
                                <motion.div
                                    key={item.id}
                                    style={{
                                        position: "absolute", bottom: 0,
                                        width: cardWidth, height: cardHeight,
                                        zIndex, transformStyle: "preserve-3d",
                                        borderRadius: "1.25rem",
                                        border: isActive
                                            ? "1px solid rgba(139,124,246,0.35)"
                                            : "1px solid rgba(139,124,246,0.08)",
                                        overflow: "hidden",
                                        boxShadow: isActive
                                            ? "0 30px 60px rgba(0,0,0,0.6), 0 0 30px rgba(139,124,246,0.08)"
                                            : "0 12px 30px rgba(0,0,0,0.4)",
                                        willChange: "transform",
                                        userSelect: "none",
                                        cursor: isActive ? "grab" : "pointer",
                                    }}
                                    initial={reduceMotion ? false : { opacity: 0, y: y + 40, x, rotateZ, rotateX, scale }}
                                    animate={{ opacity: 1, x, y: y + lift, rotateZ, rotateX, scale }}
                                    transition={{ type: "spring", stiffness: springStiffness, damping: springDamping }}
                                    onClick={() => {
                                        if (isActive && onActivate) onActivate(item);
                                        else setActive(i);
                                    }}
                                    {...dragProps}
                                >
                                    <div style={{
                                        height: "100%", width: "100%",
                                        transform: `translateZ(${z}px)`,
                                        transformStyle: "preserve-3d",
                                    }}>
                                        {renderCard
                                            ? renderCard(item, { active: isActive })
                                            : <DefaultFanCard item={item} active={isActive} />
                                        }
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Dots ────────────────────────────────────────────────── */}
            {showDots && (
                <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {items.map((it, idx) => {
                            const on = idx === active;
                            return (
                                <button
                                    key={it.id}
                                    onClick={() => setActive(idx)}
                                    aria-label={`Go to ${it.title}`}
                                    style={{
                                        width: on ? 24 : 8, height: 8,
                                        borderRadius: "50px", border: "none", padding: 0,
                                        background: on ? "rgba(139,124,246,0.9)" : "rgba(139,124,246,0.2)",
                                        cursor: "pointer",
                                        transition: "all 300ms cubic-bezier(0.22, 1, 0.36, 1)",
                                    }}
                                />
                            );
                        })}
                    </div>
                    {activeItem.href && (
                        <Link
                            to={activeItem.href}
                            style={{
                                color: "rgba(139,124,246,0.6)", display: "flex", alignItems: "center",
                                transition: "color 0.2s"
                            }}
                            aria-label="Open link"
                        >
                            <SquareArrowOutUpRight style={{ width: 16, height: 16 }} />
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── Inline SVG illustrations per domain ─────────────────────────────── */
const CARD_ILLUSTRATIONS = {
    Dashboard: (
        <svg viewBox="0 0 200 120" fill="none" style={{ width: "100%", height: "100%" }}>
            <rect x="10" y="60" width="24" height="50" rx="4" fill="rgba(139,124,246,0.3)" />
            <rect x="42" y="40" width="24" height="70" rx="4" fill="rgba(139,124,246,0.45)" />
            <rect x="74" y="25" width="24" height="85" rx="4" fill="rgba(139,124,246,0.6)" />
            <rect x="106" y="45" width="24" height="65" rx="4" fill="rgba(103,232,249,0.4)" />
            <rect x="138" y="55" width="24" height="55" rx="4" fill="rgba(103,232,249,0.25)" />
            <circle cx="22" cy="55" r="3" fill="rgba(139,124,246,0.8)" />
            <circle cx="54" cy="35" r="3" fill="rgba(139,124,246,0.8)" />
            <circle cx="86" cy="20" r="3" fill="rgba(167,139,250,0.9)" />
            <circle cx="118" cy="40" r="3" fill="rgba(103,232,249,0.7)" />
            <circle cx="150" cy="50" r="3" fill="rgba(103,232,249,0.5)" />
            <path d="M22 55 L54 35 L86 20 L118 40 L150 50" stroke="rgba(139,124,246,0.5)" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
    ),
    Inventory: (
        <svg viewBox="0 0 200 120" fill="none" style={{ width: "100%", height: "100%" }}>
            {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => (
                <rect key={`${r}-${c}`} x={20 + c * 44} y={10 + r * 36} width="36" height="28" rx="6"
                    fill={`rgba(139,124,246,${0.12 + (r * 4 + c) * 0.04})`}
                    stroke="rgba(139,124,246,0.2)" strokeWidth="0.5" />
            )))}
            <rect x="64" y="46" width="36" height="28" rx="6" fill="rgba(52,211,153,0.2)" stroke="rgba(52,211,153,0.4)" strokeWidth="1" />
            <circle cx="82" cy="60" r="5" fill="none" stroke="rgba(52,211,153,0.6)" strokeWidth="1.5" />
            <path d="M85 63 L90 68" stroke="rgba(52,211,153,0.6)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    'PCB Types': (
        <svg viewBox="0 0 200 120" fill="none" style={{ width: "100%", height: "100%" }}>
            <rect x="60" y="30" width="80" height="60" rx="4" fill="rgba(139,124,246,0.08)" stroke="rgba(139,124,246,0.3)" strokeWidth="1" />
            <rect x="80" y="45" width="40" height="30" rx="2" fill="rgba(139,124,246,0.2)" stroke="rgba(139,124,246,0.4)" strokeWidth="0.8" />
            <circle cx="88" cy="55" r="2" fill="rgba(103,232,249,0.6)" />
            <circle cx="100" cy="55" r="2" fill="rgba(167,139,250,0.6)" />
            <circle cx="112" cy="55" r="2" fill="rgba(103,232,249,0.6)" />
            {/* Traces */}
            <path d="M60 50 L80 50" stroke="rgba(139,124,246,0.4)" strokeWidth="1" />
            <path d="M120 60 L140 60" stroke="rgba(103,232,249,0.4)" strokeWidth="1" />
            <path d="M100 30 L100 45" stroke="rgba(139,124,246,0.35)" strokeWidth="1" />
            <path d="M100 75 L100 90" stroke="rgba(139,124,246,0.35)" strokeWidth="1" />
            <circle cx="60" cy="50" r="3" fill="rgba(139,124,246,0.5)" />
            <circle cx="140" cy="60" r="3" fill="rgba(103,232,249,0.5)" />
            <circle cx="100" cy="30" r="3" fill="rgba(139,124,246,0.5)" />
            <circle cx="100" cy="90" r="3" fill="rgba(139,124,246,0.5)" />
            {/* Vias */}
            <circle cx="75" cy="70" r="2" fill="none" stroke="rgba(167,139,250,0.5)" strokeWidth="1" />
            <circle cx="125" cy="40" r="2" fill="none" stroke="rgba(103,232,249,0.5)" strokeWidth="1" />
        </svg>
    ),
    Production: (
        <svg viewBox="0 0 200 120" fill="none" style={{ width: "100%", height: "100%" }}>
            <circle cx="70" cy="60" r="28" fill="none" stroke="rgba(139,124,246,0.3)" strokeWidth="1.5" />
            <circle cx="70" cy="60" r="18" fill="rgba(139,124,246,0.08)" stroke="rgba(139,124,246,0.2)" strokeWidth="1" />
            <circle cx="70" cy="60" r="4" fill="rgba(139,124,246,0.5)" />
            {/* Gear teeth */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <rect key={deg} x="67" y="30" width="6" height="8" rx="2"
                    fill="rgba(139,124,246,0.25)"
                    transform={`rotate(${deg} 70 60)`} />
            ))}
            <circle cx="130" cy="60" r="18" fill="none" stroke="rgba(103,232,249,0.25)" strokeWidth="1.5" />
            <circle cx="130" cy="60" r="10" fill="rgba(103,232,249,0.06)" stroke="rgba(103,232,249,0.15)" strokeWidth="1" />
            <circle cx="130" cy="60" r="3" fill="rgba(103,232,249,0.4)" />
            {/* Arrow */}
            <path d="M155 60 L175 60 M170 55 L175 60 L170 65" stroke="rgba(139,124,246,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    Procurement: (
        <svg viewBox="0 0 200 120" fill="none" style={{ width: "100%", height: "100%" }}>
            <rect x="15" y="40" width="40" height="40" rx="8" fill="rgba(139,124,246,0.12)" stroke="rgba(139,124,246,0.3)" strokeWidth="1" />
            <rect x="80" y="40" width="40" height="40" rx="8" fill="rgba(103,232,249,0.12)" stroke="rgba(103,232,249,0.3)" strokeWidth="1" />
            <rect x="145" y="40" width="40" height="40" rx="8" fill="rgba(52,211,153,0.12)" stroke="rgba(52,211,153,0.3)" strokeWidth="1" />
            {/* Arrows */}
            <path d="M57 60 L78 60 M73 55 L78 60 L73 65" stroke="rgba(139,124,246,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M122 60 L143 60 M138 55 L143 60 L138 65" stroke="rgba(103,232,249,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Icons inside */}
            <circle cx="35" cy="55" r="4" fill="none" stroke="rgba(139,124,246,0.5)" strokeWidth="1" />
            <path d="M33 62 L37 62" stroke="rgba(139,124,246,0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M96 55 L104 55 M96 60 L104 60 M96 65 L101 65" stroke="rgba(103,232,249,0.5)" strokeWidth="1" strokeLinecap="round" />
            <path d="M163 53 L167 57 L163 61" stroke="rgba(52,211,153,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    ),
    Reports: (
        <svg viewBox="0 0 200 120" fill="none" style={{ width: "100%", height: "100%" }}>
            <rect x="40" y="15" width="120" height="90" rx="6" fill="rgba(139,124,246,0.05)" stroke="rgba(139,124,246,0.15)" strokeWidth="1" />
            {/* Bars */}
            <rect x="55" y="70" width="16" height="25" rx="3" fill="rgba(139,124,246,0.35)" />
            <rect x="78" y="55" width="16" height="40" rx="3" fill="rgba(139,124,246,0.5)" />
            <rect x="101" y="40" width="16" height="55" rx="3" fill="rgba(167,139,250,0.5)" />
            <rect x="124" y="50" width="16" height="45" rx="3" fill="rgba(103,232,249,0.35)" />
            {/* Header lines */}
            <path d="M55 28 L100 28" stroke="rgba(139,124,246,0.3)" strokeWidth="2" strokeLinecap="round" />
            <path d="M55 35 L82 35" stroke="rgba(139,124,246,0.15)" strokeWidth="1" strokeLinecap="round" />
        </svg>
    ),
};

/* ── Default card renderer ────────────────────────────────────────────── */
function DefaultFanCard({ item, active }) {
    const illustration = CARD_ILLUSTRATIONS[item.title];

    return (
        <div style={{
            position: "relative", height: "100%", width: "100%",
            background: "linear-gradient(145deg, rgba(20,19,29,0.95), rgba(28,27,40,0.95))",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
        }}>
            {/* SVG illustration area — upper 60% */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: "60%", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "16px 24px",
            }}>
                {illustration || (
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: "rgba(139,124,246,0.12)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "rgba(139,124,246,0.5)", fontSize: 18,
                    }}>?</div>
                )}
            </div>

            {/* Subtle gradient separator */}
            <div style={{
                position: "absolute", left: 24, right: 24, top: "58%",
                height: 1,
                background: "linear-gradient(to right, transparent, rgba(139,124,246,0.2), transparent)",
            }} />

            {/* Active glow ring */}
            {active && (
                <div style={{
                    position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
                    boxShadow: "inset 0 0 0 2px rgba(139,124,246,0.5), inset 0 0 20px rgba(139,124,246,0.06)",
                }} />
            )}

            {/* Text area — lower 40% */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: "42%",
                display: "flex", flexDirection: "column", justifyContent: "center",
                padding: "0 1.5rem 1.25rem",
            }}>
                {item.tag && (
                    <div style={{
                        marginBottom: 8, display: "inline-block", padding: "3px 12px",
                        borderRadius: "50px",
                        background: "rgba(139,124,246,0.15)",
                        border: "1px solid rgba(139,124,246,0.25)",
                        color: "#c4b5fd", fontSize: "0.7rem", fontWeight: 600,
                        width: "fit-content",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                    }}>
                        {item.tag}
                    </div>
                )}
                <div style={{
                    fontSize: "1.2rem", fontWeight: 700, color: "#fff",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                }}>
                    {item.title}
                </div>
                {item.description && (
                    <div style={{
                        marginTop: 5, fontSize: "0.82rem",
                        color: "rgba(165,162,179,0.9)",
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        lineHeight: 1.45,
                    }}>
                        {item.description}
                    </div>
                )}
            </div>
        </div>
    );
}


export default CardStack;
