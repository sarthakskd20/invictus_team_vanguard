import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { cn } from '../../lib/utils';

/**
 * DottedSurface
 * Three.js particle wave background. Dark-mode only (matches app theme).
 * Uses absolute positioning so it fills its nearest positioned ancestor.
 */
export function DottedSurface({ className, ...props }) {
    const containerRef = useRef(null);
    // Store the latest animationId in a plain ref so cleanup always cancels
    // the correct frame (the inner `animate` callback keeps updating it).
    const animIdRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;

        const SEPARATION = 150;
        const AMOUNTX = 40;
        const AMOUNTY = 60;

        // ── Scene ──────────────────────────────────────────────────────────
        const scene = new THREE.Scene();
        // Subtle fog to fade edges – use pure black to match dark bg
        scene.fog = new THREE.Fog(0x000000, 2000, 10000);

        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;

        const camera = new THREE.PerspectiveCamera(60, w / h, 1, 10000);
        camera.position.set(0, 355, 1220);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h);
        renderer.setClearColor(0x000000, 0); // transparent clear
        container.appendChild(renderer.domElement);

        // ── Geometry ───────────────────────────────────────────────────────
        const positions = [];
        const colors = [];

        for (let ix = 0; ix < AMOUNTX; ix++) {
            for (let iy = 0; iy < AMOUNTY; iy++) {
                positions.push(
                    ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
                    0,
                    iy * SEPARATION - (AMOUNTY * SEPARATION) / 2,
                );
                // Light grey dots on dark background
                colors.push(0.55, 0.57, 0.62);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 7,
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // ── Animation ──────────────────────────────────────────────────────
        let count = 0;

        const animate = () => {
            animIdRef.current = requestAnimationFrame(animate);

            const posAttr = geometry.attributes.position;
            const arr = posAttr.array;

            let i = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    arr[i * 3 + 1] =
                        Math.sin((ix + count) * 0.3) * 50 +
                        Math.sin((iy + count) * 0.5) * 50;
                    i++;
                }
            }
            posAttr.needsUpdate = true;

            renderer.render(scene, camera);
            count += 0.1;
        };

        // ── Resize ─────────────────────────────────────────────────────────
        const handleResize = () => {
            const w2 = container.clientWidth || window.innerWidth;
            const h2 = container.clientHeight || window.innerHeight;
            camera.aspect = w2 / h2;
            camera.updateProjectionMatrix();
            renderer.setSize(w2, h2);
        };

        window.addEventListener('resize', handleResize);
        animate();

        // ── Cleanup ────────────────────────────────────────────────────────
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animIdRef.current);

            scene.traverse((obj) => {
                if (obj instanceof THREE.Points) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m) => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
            {...props}
        />
    );
}

export default DottedSurface;
