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
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
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
                    borderRadius: "50%", background: "rgba(255,255,255,0.03)", filter: "blur(40px)",
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
                        background: "rgba(20,20,20,0.65)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "50%", width: 40, height: 40,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: canGoPrev ? "pointer" : "not-allowed",
                        opacity: canGoPrev ? 1 : 0.25, color: "#fff",
                        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (canGoPrev) e.currentTarget.style.background = "rgba(40,40,40,0.85)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,20,20,0.65)"; }}
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
                        background: "rgba(20,20,20,0.65)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "50%", width: 40, height: 40,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: canGoNext ? "pointer" : "not-allowed",
                        opacity: canGoNext ? 1 : 0.25, color: "#fff",
                        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (canGoNext) e.currentTarget.style.background = "rgba(40,40,40,0.85)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,20,20,0.65)"; }}
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
                                        borderRadius: "1rem",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        overflow: "hidden",
                                        boxShadow: isActive
                                            ? "0 30px 60px rgba(0,0,0,0.6)"
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {items.map((it, idx) => {
                            const on = idx === active;
                            return (
                                <button
                                    key={it.id}
                                    onClick={() => setActive(idx)}
                                    aria-label={`Go to ${it.title}`}
                                    style={{
                                        width: 8, height: 8, borderRadius: "50%", border: "none", padding: 0,
                                        background: on ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                                        cursor: "pointer",
                                        transition: "background 0.2s, transform 0.2s",
                                        transform: on ? "scale(1.3)" : "scale(1)",
                                    }}
                                />
                            );
                        })}
                    </div>
                    {activeItem.href && (
                        <Link
                            to={activeItem.href}
                            style={{
                                color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
                                transition: "color 0.15s"
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

/* ── Default card renderer ────────────────────────────────────────────── */
function DefaultFanCard({ item, active }) {
    return (
        <div style={{ position: "relative", height: "100%", width: "100%" }}>
            {/* Image */}
            <div style={{ position: "absolute", inset: 0 }}>
                {item.imageSrc ? (
                    <img
                        src={item.imageSrc}
                        alt={item.title}
                        style={{ height: "100%", width: "100%", objectFit: "cover" }}
                        draggable={false}
                        loading="eager"
                    />
                ) : (
                    <div style={{
                        display: "flex", height: "100%", width: "100%", alignItems: "center",
                        justifyContent: "center", background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.35)", fontSize: 13
                    }}>
                        No image
                    </div>
                )}
            </div>

            {/* Scrim — strong enough to guarantee legibility over any photo */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: [
                    "linear-gradient(to top,",
                    "  rgba(0,0,0,0.88) 0%,",
                    "  rgba(0,0,0,0.50) 45%,",
                    "  rgba(0,0,0,0.10) 70%,",
                    "  transparent 100%)",
                ].join(" "),
            }} />

            {/* Extra darkening strip right at the text zone */}
            <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                height: "55%", pointerEvents: "none",
                background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
            }} />

            {/* Active glow border */}
            {active && (
                <div style={{
                    position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
                    boxShadow: "inset 0 0 0 2px rgba(99,102,241,0.75)",
                }} />
            )}

            {/* Text */}
            <div style={{
                position: "relative", zIndex: 10,
                display: "flex", height: "100%", flexDirection: "column", justifyContent: "flex-end",
                padding: "1.25rem 1.5rem",
            }}>
                {item.tag && (
                    <div style={{
                        marginBottom: 8, display: "inline-block", padding: "3px 10px",
                        borderRadius: "50px",
                        background: "rgba(80,70,180,0.65)",
                        border: "1px solid rgba(140,130,255,0.55)",
                        color: "#e0dbff", fontSize: "0.7rem", fontWeight: 600,
                        width: "fit-content",
                        textShadow: "none",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                    }}>
                        {item.tag}
                    </div>
                )}
                <div style={{
                    fontSize: "1.15rem", fontWeight: 700, color: "#fff",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    textShadow: "0 1px 8px rgba(0,0,0,0.9), 0 0px 1px rgba(0,0,0,1)",
                    letterSpacing: "-0.01em",
                }}>
                    {item.title}
                </div>
                {item.description && (
                    <div style={{
                        marginTop: 5, fontSize: "0.82rem",
                        color: "rgba(255,255,255,0.92)",
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        textShadow: "0 1px 6px rgba(0,0,0,0.85)",
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
