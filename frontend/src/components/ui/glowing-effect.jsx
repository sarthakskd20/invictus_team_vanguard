import { memo, useCallback, useEffect, useRef } from "react";
import { animate } from "motion/react";
import { cn } from "../../lib/utils";

const GlowingEffect = memo(({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = "default",
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
}) => {
    const containerRef = useRef(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef(0);

    const handleMove = useCallback((e) => {
        if (!containerRef.current) return;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        animationFrameRef.current = requestAnimationFrame(() => {
            const element = containerRef.current;
            if (!element) return;

            const { left, top, width, height } = element.getBoundingClientRect();
            const mouseX = e?.x ?? lastPosition.current.x;
            const mouseY = e?.y ?? lastPosition.current.y;
            if (e) lastPosition.current = { x: mouseX, y: mouseY };

            const center = [left + width * 0.5, top + height * 0.5];
            const distFromCenter = Math.hypot(mouseX - center[0], mouseY - center[1]);
            const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

            if (distFromCenter < inactiveRadius) {
                element.style.setProperty("--active", "0");
                return;
            }

            const isActive =
                mouseX > left - proximity &&
                mouseX < left + width + proximity &&
                mouseY > top - proximity &&
                mouseY < top + height + proximity;

            element.style.setProperty("--active", isActive ? "1" : "0");
            if (!isActive) return;

            const currentAngle = parseFloat(element.style.getPropertyValue("--start")) || 0;
            const targetAngle = (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;
            const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
            const newAngle = currentAngle + angleDiff;

            animate(currentAngle, newAngle, {
                duration: movementDuration,
                ease: [0.16, 1, 0.3, 1],
                onUpdate: (value) => element.style.setProperty("--start", String(value)),
            });
        });
    }, [inactiveZone, proximity, movementDuration]);

    useEffect(() => {
        if (disabled) return;
        const onScroll = () => handleMove();
        const onMove = (e) => handleMove(e);
        window.addEventListener("scroll", onScroll, { passive: true });
        document.body.addEventListener("pointermove", onMove, { passive: true });
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            window.removeEventListener("scroll", onScroll);
            document.body.removeEventListener("pointermove", onMove);
        };
    }, [handleMove, disabled]);

    /* Gradient value */
    const gradient = variant === "white"
        ? `repeating-conic-gradient(from 236.84deg at 50% 50%, #000, #000 calc(25% / 5))`
        : [
            "radial-gradient(circle, #dd7bbb 10%, #dd7bbb00 20%)",
            "radial-gradient(circle at 40% 40%, #d79f1e 5%, #d79f1e00 15%)",
            "radial-gradient(circle at 60% 60%, #5a922c 10%, #5a922c00 20%)",
            "radial-gradient(circle at 40% 60%, #4c7894 10%, #4c789400 20%)",
            "repeating-conic-gradient(from 236.84deg at 50% 50%, #dd7bbb 0%, #d79f1e calc(25%/5), #5a922c calc(50%/5), #4c7894 calc(75%/5), #dd7bbb calc(100%/5))",
        ].join(", ");

    if (disabled) {
        /* Static border when disabled / always-on glow */
        return (
            <div style={{
                position: "absolute",
                inset: -1,
                borderRadius: "inherit",
                border: `1px solid ${variant === "white" ? "white" : "transparent"}`,
                opacity: glow ? 1 : 0,
                pointerEvents: "none",
                transition: "opacity 300ms",
            }} />
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                "--blur": `${blur}px`,
                "--spread": spread,
                "--start": "0",
                "--active": "0",
                "--glowingeffect-border-width": `${borderWidth}px`,
                "--gradient": gradient,
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                pointerEvents: "none",
                filter: blur > 0 ? `blur(${blur}px)` : undefined,
            }}
        >
            <div className={cn("glow-border", className)} />
        </div>
    );
});

GlowingEffect.displayName = "GlowingEffect";
export { GlowingEffect };
export default GlowingEffect;
