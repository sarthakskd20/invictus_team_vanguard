import { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

/**
 * IsoLevelWarp
 * Isometric / topographic wave-grid background driven by Canvas 2D.
 *
 * Props:
 *   color    – RGB values as a string, e.g. "100, 50, 250"
 *   speed    – animation speed multiplier (default 1)
 *   density  – grid cell size in px; lower = more lines (default 40)
 *   className – additional Tailwind / CSS classes for the wrapper
 */
const IsoLevelWarp = ({
    className,
    color = '14, 165, 233', // Tailwind sky-500
    speed = 1,
    density = 40,
    ...props
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = container.offsetWidth;
        let height = container.offsetHeight;
        let animationFrameId;

        // Grid config — recalculated on resize
        let rows, cols;

        // Smooth mouse position
        const mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };

        let time = 0;

        const calcGrid = () => {
            rows = Math.ceil(height / density) + 5;
            cols = Math.ceil(width / density) + 5;
        };

        const resize = () => {
            width = container.offsetWidth;
            height = container.offsetHeight;
            canvas.width = width;
            canvas.height = height;
            calcGrid();
        };

        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.targetX = e.clientX - rect.left;
            mouse.targetY = e.clientY - rect.top;
        };

        const handleMouseLeave = () => {
            mouse.targetX = -1000;
            mouse.targetY = -1000;
        };

        const smoothMix = (a, b, t) => a + (b - a) * t;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            // Smooth mouse tracking
            mouse.x = smoothMix(mouse.x, mouse.targetX, 0.1);
            mouse.y = smoothMix(mouse.y, mouse.targetY, 0.1);

            time += 0.01 * speed;

            // ── Horizontal rows ──────────────────────────────────────────
            ctx.beginPath();
            for (let y = 0; y <= rows; y++) {
                let isFirst = true;
                for (let x = 0; x <= cols; x++) {
                    const baseX = x * density - density * 2;
                    const baseY = y * density - density * 2;

                    // Ambient breathing wave
                    const wave =
                        Math.sin(x * 0.2 + time) *
                        Math.cos(y * 0.2 + time) *
                        15;

                    // Mouse repulsion (Z-push upward)
                    const dx = baseX - mouse.x;
                    const dy = baseY - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const maxDist = 250;
                    const force = Math.max(0, (maxDist - dist) / maxDist);
                    const interactionY = -(force * force) * 80;

                    const finalX = baseX;
                    const finalY = baseY + wave + interactionY;

                    if (isFirst) {
                        ctx.moveTo(finalX, finalY);
                        isFirst = false;
                    } else {
                        ctx.lineTo(finalX, finalY);
                    }
                }
            }

            // ── Vertical columns ─────────────────────────────────────────
            for (let x = 0; x <= cols; x++) {
                let isFirst = true;
                for (let y = 0; y <= rows; y++) {
                    const baseX = x * density - density * 2;
                    const baseY = y * density - density * 2;

                    const wave =
                        Math.sin(x * 0.2 + time) *
                        Math.cos(y * 0.2 + time) *
                        15;

                    const dx = baseX - mouse.x;
                    const dy = baseY - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const maxDist = 250;
                    const force = Math.max(0, (maxDist - dist) / maxDist);
                    const interactionY = -(force * force) * 80;

                    const finalX = baseX;
                    const finalY = baseY + wave + interactionY;

                    if (isFirst) {
                        ctx.moveTo(finalX, finalY);
                        isFirst = false;
                    } else {
                        ctx.lineTo(finalX, finalY);
                    }
                }
            }

            // ── Gradient stroke ───────────────────────────────────────────
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, `rgba(${color}, 0)`);
            gradient.addColorStop(0.5, `rgba(${color}, 0.45)`);
            gradient.addColorStop(1, `rgba(${color}, 0)`);

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.8;
            ctx.stroke();

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);

        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, [color, speed, density]);

    return (
        <div
            ref={containerRef}
            className={cn('absolute inset-0 z-0 overflow-hidden', className)}
            style={{ background: '#000' }}
            {...props}
        >
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

            {/* Radial vignette for depth / focus */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.75) 100%)',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
};

export default IsoLevelWarp;
