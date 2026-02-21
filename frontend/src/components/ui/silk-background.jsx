import { useEffect, useRef } from 'react';

/**
 * Subtle silk-like animated canvas background.
 * Renders flowing purple-gray silk texture at low opacity.
 */
export default function SilkBackground() {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let time = 0;
        const speed = 0.015;
        const scale = 2;
        const noiseIntensity = 0.7;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Simple noise function
        const noise = (x, y) => {
            const G = 2.71828;
            const rx = G * Math.sin(G * x);
            const ry = G * Math.sin(G * y);
            return (rx * ry * (1 + x)) % 1;
        };

        const animate = () => {
            const { width, height } = canvas;

            // Clear with dark background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#0d0c14');
            gradient.addColorStop(0.5, '#161522');
            gradient.addColorStop(1, '#0d0c14');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Create silk-like pattern (render at 3px steps for performance)
            const imageData = ctx.createImageData(width, height);
            const data = imageData.data;
            const step = 3;

            for (let x = 0; x < width; x += step) {
                for (let y = 0; y < height; y += step) {
                    const u = (x / width) * scale;
                    const v = (y / height) * scale;

                    const tOffset = speed * time;
                    const tex_y = v + 0.03 * Math.sin(8.0 * u - tOffset);

                    const pattern = 0.6 + 0.4 * Math.sin(
                        5.0 * (u + tex_y +
                            Math.cos(3.0 * u + 5.0 * tex_y) +
                            0.02 * tOffset) +
                        Math.sin(20.0 * (u + tex_y - 0.1 * tOffset))
                    );

                    const rnd = noise(x, y);
                    const intensity = Math.max(0, pattern - rnd / 15.0 * noiseIntensity);

                    // Purple-gray silk hue matching the theme
                    const r = Math.floor(90 * intensity);
                    const g = Math.floor(82 * intensity);
                    const b = Math.floor(110 * intensity);
                    const a = 255;

                    // Fill the step×step block
                    for (let dx = 0; dx < step && x + dx < width; dx++) {
                        for (let dy = 0; dy < step && y + dy < height; dy++) {
                            const index = ((y + dy) * width + (x + dx)) * 4;
                            data[index] = r;
                            data[index + 1] = g;
                            data[index + 2] = b;
                            data[index + 3] = a;
                        }
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);

            // Radial overlay for depth
            const overlayGradient = ctx.createRadialGradient(
                width / 2, height / 2, 0,
                width / 2, height / 2, Math.max(width, height) / 2
            );
            overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
            overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.45)');

            ctx.fillStyle = overlayGradient;
            ctx.fillRect(0, 0, width, height);

            time += 1;
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.45,
            }}
            aria-hidden="true"
        />
    );
}
