/**
 * LoginPage.tsx — NirogOS Unified Login
 *
 * Doctor portal  → deep space indigo, animated characters
 * Pharmacy portal → midnight black, premium 3D orbital scene (NO characters)
 *
 * BUG FIXES:
 * - Removed broken sm:w-[calc(${w}*1.1)] dynamic Tailwind class
 * - Removed unused accentColor prop from FormInput
 * - Removed style={{ boxShadow: undefined }} noop
 * - AuthContext no longer throws outside provider (see AuthContext.tsx fix)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mail, Lock, Loader2, ArrowRight, User, Eye, EyeOff, X, ShieldCheck, Stethoscope, Package } from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/db';
import { ensureDoctorClinicSetup } from '../services/doctorService';
import { fetchProfileRole, syncAndFetchPharmacyProfile } from '../services/pharmacyService';
import { Logo } from '../src/components/Logo';

type PortalMode = 'doctor' | 'pharmacy';

// ─── Mouse tracker ────────────────────────────────────────────────
function useMousePosition() {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const h = (e: MouseEvent | TouchEvent) => {
            const p = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
            setPos({ x: p.clientX, y: p.clientY });
        };
        window.addEventListener('mousemove', h, { passive: true });
        window.addEventListener('touchmove', h, { passive: true });
        return () => { window.removeEventListener('mousemove', h); window.removeEventListener('touchmove', h); };
    }, []);
    return pos;
}

function usePupilOffset(
    mouse: { x: number; y: number },
    eyeRef: React.RefObject<SVGCircleElement>,
    maxOffset: number,
    blind: boolean,
) {
    const sx = useSpring(0, { stiffness: 90, damping: 22 });
    const sy = useSpring(0, { stiffness: 90, damping: 22 });
    useEffect(() => {
        if (blind || !eyeRef.current) { sx.set(0); sy.set(0); return; }
        const rect = eyeRef.current.getBoundingClientRect();
        const dx = mouse.x - (rect.left + rect.width / 2);
        const dy = mouse.y - (rect.top + rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const factor = Math.min(dist, 100) / 100;
        sx.set((dx / dist) * maxOffset * factor);
        sy.set((dy / dist) * maxOffset * factor);
    }, [mouse.x, mouse.y, blind, maxOffset]); // eslint-disable-line react-hooks/exhaustive-deps
    return { sx, sy };
}

// ─── Eye / Mouth primitives ───────────────────────────────────────
const AbstractEye = ({ cx, cy, r, mouse, emotion, sclera = 'white', pupil = '#1e1b4b' }: any) => {
    const ref = useRef<SVGCircleElement>(null);
    const pr = r * 0.45;
    const isBlind = emotion === 'password';
    const isSad = emotion === 'sad';
    const { sx, sy } = usePupilOffset(mouse, ref, r * 0.42, isBlind || isSad);
    const px = useTransform(sx, (v: number) => cx + v);
    const py = useTransform(sy, (v: number) => cy + v);
    const shineX = useTransform(sx, (v: number) => cx + v + pr * 0.4);
    const shineY = useTransform(sy, (v: number) => cy + v - pr * 0.4);
    return (
        <g>
            <circle ref={ref} cx={cx} cy={cy} r={r} fill={sclera} />
            {!isBlind && !isSad && (
                <motion.ellipse cx={cx} cy={cy} rx={r} ry={r * 0.08} fill={sclera}
                    animate={{ ry: [r * 0.08, r, r * 0.08] }}
                    transition={{ repeat: Infinity, duration: 0.24, repeatDelay: 4.8 + Math.random() * 2, ease: 'easeInOut', times: [0, 0.5, 1] }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }} />
            )}
            <AnimatePresence>
                {isBlind && (
                    <motion.rect key="blind" x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={r} fill={sclera}
                        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
                        style={{ transformOrigin: `${cx}px ${cy}px` }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22 }} />
                )}
            </AnimatePresence>
            {isSad && (
                <g stroke={pupil} strokeWidth="2" strokeLinecap="round">
                    <line x1={cx - r * 0.5} y1={cy - r * 0.5} x2={cx + r * 0.5} y2={cy + r * 0.5} />
                    <line x1={cx + r * 0.5} y1={cy - r * 0.5} x2={cx - r * 0.5} y2={cy + r * 0.5} />
                </g>
            )}
            {!isBlind && !isSad && (
                <>
                    <motion.circle r={pr} fill={pupil} style={{ x: px, y: py }} />
                    <motion.circle r={pr * 0.3} fill="rgba(255,255,255,0.9)" style={{ x: shineX, y: shineY }} />
                </>
            )}
        </g>
    );
};

const AbstractMouth = ({ cx, cy, w, emotion, color }: any) => {
    const h = w * 0.35;
    const d = emotion === 'sad'
        ? `M${cx - w} ${cy + h} Q${cx} ${cy - h * 0.5} ${cx + w} ${cy + h}`
        : emotion === 'password'
            ? `M${cx - w * 0.7} ${cy} L${cx + w * 0.7} ${cy}`
            : `M${cx - w} ${cy} Q${cx} ${cy + h * 1.2} ${cx + w} ${cy}`;
    return (
        <AnimatePresence mode="wait">
            <motion.path key={d} d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0 }}
                transition={{ duration: 0.28 }} />
        </AnimatePresence>
    );
};

const Breathing = ({ delay = 0, range = 3, duration = 3.5, children }: any) => (
    <motion.div animate={{ y: [0, -range, 0] }}
        transition={{ repeat: Infinity, duration, ease: [0.45, 0, 0.55, 1], delay }}>
        {children}
    </motion.div>
);

// ─── Doctor characters ────────────────────────────────────────────
const CharPurple = ({ mouse, emotion }: any) => {
    const isSad = emotion === 'sad';
    return (
        <g>
            <rect x="8" y="44" width="64" height="108" rx="24" fill="#6D28D9" />
            <rect x="8" y="44" width="32" height="108" rx="24" fill="#7C3AED" opacity="0.45" />
            <ellipse cx="30" cy="100" rx="14" ry="20" fill="#8B5CF6" opacity="0.25" />
            <rect x="14" y="142" width="22" height="16" rx="8" fill="#4C1D95" />
            <rect x="44" y="142" width="22" height="16" rx="8" fill="#4C1D95" />
            <rect x="26" y="36" width="28" height="16" rx="8" fill="#7C3AED" />
            <motion.g animate={isSad ? { rotateX: 20, y: 8 } : { rotateX: 0, y: 0 }}
                transition={isSad ? { type: 'spring', stiffness: 140, damping: 14, delay: 0.05 } : { type: 'spring', stiffness: 160, damping: 18 }}
                style={{ originX: '40px', originY: '28px' }}>
                <rect x="10" y="4" width="60" height="52" rx="22" fill="#7C3AED" />
                <rect x="10" y="4" width="28" height="52" rx="22" fill="#8B5CF6" opacity="0.4" />
                <AbstractEye cx={28} cy={28} r={9} mouse={mouse} emotion={emotion} />
                <AbstractEye cx={52} cy={28} r={9} mouse={mouse} emotion={emotion} />
                <AbstractMouth cx={40} cy={44} w={10} emotion={emotion} color="#DDD6FE" />
            </motion.g>
            <rect x="-6" y="64" width="18" height="44" rx="9" fill="#6D28D9" />
            <rect x="68" y="64" width="18" height="44" rx="9" fill="#6D28D9" />
            <ellipse cx="1" cy="110" rx="9" ry="8" fill="#5B21B6" />
            <ellipse cx="79" cy="110" rx="9" ry="8" fill="#5B21B6" />
        </g>
    );
};
const CharOrange = ({ mouse, emotion }: any) => (
    <g>
        <rect x="4" y="30" width="68" height="82" rx="28" fill="#F97316" />
        <rect x="4" y="30" width="36" height="82" rx="28" fill="#FB923C" opacity="0.35" />
        <rect x="10" y="102" width="20" height="14" rx="7" fill="#C2410C" />
        <rect x="46" y="102" width="20" height="14" rx="7" fill="#C2410C" />
        <rect x="24" y="22" width="28" height="14" rx="7" fill="#FB923C" />
        <rect x="6" y="2" width="64" height="46" rx="20" fill="#FB923C" />
        <rect x="6" y="2" width="30" height="46" rx="20" fill="#FDBA74" opacity="0.3" />
        <AbstractEye cx={30} cy={22} r={8} mouse={mouse} emotion={emotion} pupil="#7C2D12" />
        <AbstractEye cx={54} cy={22} r={8} mouse={mouse} emotion={emotion} pupil="#7C2D12" />
        <AbstractMouth cx={42} cy={36} w={9} emotion={emotion} color="#EA580C" />
        <ellipse cx="14" cy="26" rx="7" ry="5" fill="#FCA5A5" opacity="0.4" />
        <ellipse cx="62" cy="26" rx="7" ry="5" fill="#FCA5A5" opacity="0.4" />
        <rect x="-8" y="44" width="16" height="38" rx="8" fill="#F97316" />
        <rect x="68" y="44" width="16" height="38" rx="8" fill="#F97316" />
    </g>
);
const CharDark = ({ mouse, emotion }: any) => (
    <g>
        <rect x="8" y="38" width="44" height="90" rx="22" fill="#1E293B" />
        <rect x="8" y="38" width="22" height="90" rx="22" fill="#334155" opacity="0.4" />
        <rect x="10" y="118" width="16" height="13" rx="6" fill="#0F172A" />
        <rect x="34" y="118" width="16" height="13" rx="6" fill="#0F172A" />
        <rect x="20" y="30" width="20" height="12" rx="6" fill="#334155" />
        <rect x="4" y="4" width="52" height="40" rx="18" fill="#334155" />
        <rect x="4" y="4" width="24" height="40" rx="18" fill="#475569" opacity="0.35" />
        <AbstractEye cx={22} cy={22} r={7} mouse={mouse} emotion={emotion} sclera="#94A3B8" pupil="#0F172A" />
        <AbstractEye cx={42} cy={22} r={7} mouse={mouse} emotion={emotion} sclera="#94A3B8" pupil="#0F172A" />
        <AbstractMouth cx={30} cy={34} w={8} emotion={emotion} color="#94A3B8" />
        <rect x="-4" y="50" width="14" height="32" rx="7" fill="#1E293B" />
        <rect x="50" y="50" width="14" height="32" rx="7" fill="#1E293B" />
    </g>
);
const CharYellow = ({ mouse, emotion }: any) => (
    <g>
        <ellipse cx="38" cy="68" rx="36" ry="40" fill="#F59E0B" />
        <ellipse cx="24" cy="68" rx="20" ry="40" fill="#FCD34D" opacity="0.35" />
        <rect x="10" y="98" width="16" height="12" rx="6" fill="#B45309" />
        <rect x="48" y="98" width="16" height="12" rx="6" fill="#B45309" />
        <rect x="23" y="24" width="30" height="12" rx="6" fill="#FCD34D" />
        <ellipse cx="38" cy="18" rx="28" ry="22" fill="#FCD34D" />
        <ellipse cx="26" cy="18" rx="14" ry="22" fill="#FDE68A" opacity="0.35" />
        <AbstractEye cx={28} cy={14} r={7} mouse={mouse} emotion={emotion} sclera="white" pupil="#78350F" />
        <AbstractEye cx={48} cy={14} r={7} mouse={mouse} emotion={emotion} sclera="white" pupil="#78350F" />
        <AbstractMouth cx={38} cy={28} w={8} emotion={emotion} color="#B45309" />
        <ellipse cx="12" cy="20" rx="6" ry="4" fill="#FCA5A5" opacity="0.5" />
        <ellipse cx="64" cy="20" rx="6" ry="4" fill="#FCA5A5" opacity="0.5" />
        <ellipse cx="4" cy="62" rx="8" ry="14" fill="#F59E0B" />
        <ellipse cx="72" cy="62" rx="8" ry="14" fill="#F59E0B" />
    </g>
);

// ─── Doctor character stage ───────────────────────────────────────
const DoctorStage = ({ emotion, compact = false }: { emotion: string; compact?: boolean }) => {
    const mouse = useMousePosition();
    const chars = [
        { vb: '0 0 80 160', cls: 'w-[78px]  h-[156px] md:w-[118px] md:h-[236px]', delay: 0, C: CharPurple },
        { vb: '0 0 76 118', cls: 'w-[68px]  h-[108px] md:w-24      md:h-[148px]', delay: 0.9, C: CharOrange },
        { vb: '0 0 60 134', cls: 'w-[50px]  h-[112px] md:w-[68px]  md:h-[154px]', delay: 1.6, C: CharDark },
        { vb: '0 0 76 116', cls: 'w-[58px]  h-[88px]  md:w-[78px]  md:h-[120px]', delay: 0.45, C: CharYellow },
    ];

    if (compact) {
        return (
            <div className="relative flex flex-col items-center w-full" style={{ height: '100px' }}>
                <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-2">
                    <div className="w-4/5 h-4/5 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 72%)' }} />
                </div>
                <div className="absolute bottom-0 left-1/2 flex items-end justify-center gap-2"
                    style={{ transform: 'translateX(-50%) scale(0.46)', transformOrigin: 'bottom center' }}>
                    {chars.map(({ vb, delay, C }, i) => (
                        <Breathing key={i} delay={delay} range={3} duration={3.8 + i * 0.3}>
                            <svg viewBox={vb} className="w-[68px] h-[108px] overflow-visible drop-shadow-lg">
                                <C mouse={mouse} emotion={emotion} />
                            </svg>
                        </Breathing>
                    ))}
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-3 w-3/5 rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)' }} />
            </div>
        );
    }

    return (
        <div className="relative flex flex-col items-center w-full">
            <AnimatePresence>
                {(emotion === 'password' || emotion === 'sad' || emotion === 'success') && (
                    <motion.div className="absolute -top-8 inset-x-0 flex justify-center z-20"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border backdrop-blur-sm
                            ${emotion === 'password' ? 'bg-slate-800/80 text-slate-200 border-slate-600'
                                : emotion === 'sad' ? 'bg-red-950/80 text-red-300 border-red-800'
                                    : 'bg-violet-900/80 text-violet-200 border-violet-700'}`}>
                            {emotion === 'password' && '🙈 Discretion activated'}
                            {emotion === 'sad' && '😕 Check credentials and try again'}
                            {emotion === 'success' && '🎉 Access granted!'}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-4">
                <div className="w-4/5 h-4/5 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 72%)' }} />
            </div>
            <div className="flex items-end justify-center gap-3 sm:gap-5 relative pt-6">
                {chars.map(({ vb, cls, delay, C }, i) => (
                    <motion.div key={i}
                        initial={{ x: [-60, -40, 40, 60][i], opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: [0.1, 0.22, 0.35, 0.46][i] }}>
                        <Breathing delay={delay} range={3} duration={3.8 + i * 0.3}>
                            {/* BUG FIX: removed broken sm:w-[calc(${w}*1.1)] dynamic class */}
                            <svg viewBox={vb} className={`${cls} overflow-visible drop-shadow-lg`}>
                                <C mouse={mouse} emotion={emotion} />
                            </svg>
                        </Breathing>
                    </motion.div>
                ))}
            </div>
            <div className="relative mt-1 w-full flex justify-center">
                <div className="h-4 w-4/5 rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.40) 0%, transparent 70%)' }} />
            </div>
        </div>
    );
};

// ─── Pharmacy 3D scene (NO characters — premium geometric elements) ──
const PharmacyScene3D = ({ compact = false }: { compact?: boolean }) => {
    const size = compact ? 180 : 320;
    const cx = size / 2;
    const cy = compact ? 85 : 155;

    return (
        <div className="relative flex items-center justify-center w-full" style={{ height: compact ? 100 : 280 }}>
            <svg
                width={size} height={compact ? 100 : 280}
                viewBox={`0 0 ${size} ${compact ? 100 : 280}`}
                overflow="visible"
            >
                <defs>
                    {/* 3D sphere gradient — bright top-left highlight */}
                    <radialGradient id="sphereGrad" cx="35%" cy="30%" r="65%">
                        <stop offset="0%" stopColor="#A5B4FC" stopOpacity="0.95" />
                        <stop offset="40%" stopColor="#6366F1" stopOpacity="0.90" />
                        <stop offset="75%" stopColor="#4338CA" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#1E1B4B" stopOpacity="1" />
                    </radialGradient>
                    {/* Pill gradient */}
                    <radialGradient id="pillGrad" cx="30%" cy="25%" r="70%">
                        <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.9" />
                        <stop offset="50%" stopColor="#818CF8" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3730A3" stopOpacity="0.9" />
                    </radialGradient>
                    {/* Outer ring gradient */}
                    <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
                        <stop offset="85%" stopColor="#6366F1" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#818CF8" stopOpacity="0.35" />
                    </radialGradient>
                    {/* Glow filter */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation={compact ? 3 : 6} result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
                        <feGaussianBlur stdDeviation={compact ? 8 : 18} result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    {/* Pill capsule shape */}
                    <rect id="pillShape" width={compact ? 20 : 36} height={compact ? 9 : 15}
                        rx={compact ? 4.5 : 7.5} fill="url(#pillGrad)" />
                </defs>

                {/* ── Ambient glow behind sphere ── */}
                <circle cx={cx} cy={cy} r={compact ? 38 : 72} fill="url(#ringGrad)" filter="url(#softGlow)" />

                {/* ── Hex grid background (subtle) ── */}
                {!compact && (
                    <g opacity="0.06" stroke="#818CF8" strokeWidth="0.8" fill="none">
                        {[...Array(5)].map((_, row) =>
                            [...Array(6)].map((__, col) => {
                                const hx = 28 * col + (row % 2 === 0 ? 14 : 0) + 10;
                                const hy = 24 * row + 30;
                                const R = 13;
                                const pts = [...Array(6)].map((_, k) => {
                                    const a = (Math.PI / 3) * k - Math.PI / 6;
                                    return `${hx + R * Math.cos(a)},${hy + R * Math.sin(a)}`;
                                }).join(' ');
                                return <polygon key={`${row}-${col}`} points={pts} />;
                            })
                        )}
                    </g>
                )}

                {/* ── Outer orbital ring 1 (tilted ellipse) ── */}
                <motion.g
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
                    style={{ originX: `${cx}px`, originY: `${cy}px` }}>
                    <ellipse cx={cx} cy={cy}
                        rx={compact ? 48 : 90} ry={compact ? 14 : 26}
                        fill="none" stroke="#6366F1" strokeWidth={compact ? 0.8 : 1.2}
                        strokeOpacity="0.45" />
                    {/* Dot on the ring */}
                    <circle cx={cx + (compact ? 48 : 90)} cy={cy}
                        r={compact ? 3 : 5}
                        fill="#A5B4FC" filter="url(#glow)" />
                </motion.g>

                {/* ── Outer orbital ring 2 (different tilt) ── */}
                <motion.g
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
                    style={{ originX: `${cx}px`, originY: `${cy}px` }}>
                    <ellipse cx={cx} cy={cy}
                        rx={compact ? 36 : 68} ry={compact ? 20 : 38}
                        fill="none" stroke="#818CF8" strokeWidth={compact ? 0.7 : 1}
                        strokeOpacity="0.35"
                        transform={`rotate(55 ${cx} ${cy})`} />
                    <circle
                        cx={cx + (compact ? 20 : 38) * Math.cos(Math.PI * 0.6)}
                        cy={cy + (compact ? 36 : 68) * Math.sin(Math.PI * 0.6)}
                        r={compact ? 2.5 : 4}
                        fill="#C7D2FE" filter="url(#glow)" />
                </motion.g>

                {/* ── Outer orbital ring 3 (vertical-ish) ── */}
                <motion.g
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 22, ease: 'linear' }}
                    style={{ originX: `${cx}px`, originY: `${cy}px` }}>
                    <ellipse cx={cx} cy={cy}
                        rx={compact ? 16 : 30} ry={compact ? 42 : 80}
                        fill="none" stroke="#4F46E5" strokeWidth={compact ? 0.7 : 1}
                        strokeOpacity="0.3"
                        transform={`rotate(20 ${cx} ${cy})`} />
                    <circle cx={cx} cy={cy - (compact ? 42 : 80)}
                        r={compact ? 2 : 3.5}
                        fill="#818CF8" filter="url(#glow)" />
                </motion.g>

                {/* ── Floating pills (geometric — 3D shaded capsules) ── */}
                {!compact && (
                    <>
                        <motion.g
                            animate={{ y: [-4, 4, -4], rotate: [0, 8, 0] }}
                            transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
                            style={{ originX: '46px', originY: '62px' }}>
                            <rect x="28" y="55" width="36" height="15" rx="7.5" fill="url(#pillGrad)" />
                            {/* Seam */}
                            <rect x="43" y="55" width="2" height="15" rx="0" fill="#1E1B4B" opacity="0.4" />
                            {/* Specular highlight */}
                            <ellipse cx="36" cy="59" rx="8" ry="3" fill="white" opacity="0.18" />
                        </motion.g>

                        <motion.g
                            animate={{ y: [5, -5, 5], rotate: [0, -12, 0] }}
                            transition={{ repeat: Infinity, duration: 5.8, ease: 'easeInOut', delay: 1.2 }}
                            style={{ originX: `${size - 46}px`, originY: '78px' }}>
                            <rect x={size - 64} y="70" width="36" height="15" rx="7.5" fill="url(#pillGrad)" />
                            <rect x={size - 49} y="70" width="2" height="15" fill="#1E1B4B" opacity="0.4" />
                            <ellipse cx={size - 54} cy="74" rx="8" ry="3" fill="white" opacity="0.18" />
                        </motion.g>

                        <motion.g
                            animate={{ y: [-3, 6, -3], rotate: [0, 6, 0] }}
                            transition={{ repeat: Infinity, duration: 6.5, ease: 'easeInOut', delay: 2.5 }}
                            style={{ originX: `${cx - 20}px`, originY: '228px' }}>
                            <rect x={cx - 38} y="220" width="30" height="12" rx="6" fill="url(#pillGrad)" opacity="0.7" />
                            <rect x={cx - 24} y="220" width="1.5" height="12" fill="#1E1B4B" opacity="0.35" />
                            <ellipse cx={cx - 32} cy="224" rx="6" ry="2.5" fill="white" opacity="0.15" />
                        </motion.g>

                        {/* Floating cross / plus symbol */}
                        <motion.g
                            animate={{ y: [-5, 5, -5], opacity: [0.5, 0.9, 0.5] }}
                            transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut', delay: 0.8 }}
                            filter="url(#glow)">
                            <rect x={size - 30} y="190" width="4" height="16" rx="2" fill="#818CF8" opacity="0.7" />
                            <rect x={size - 36} y="196" width="16" height="4" rx="2" fill="#818CF8" opacity="0.7" />
                        </motion.g>

                        {/* Small diamond accents */}
                        <motion.g
                            animate={{ rotate: [0, 90, 180, 270, 360], opacity: [0.3, 0.7, 0.3] }}
                            transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                            style={{ originX: '22px', originY: '195px' }}>
                            <rect x="16" y="189" width="12" height="12" rx="2"
                                fill="none" stroke="#6366F1" strokeWidth="1.2" opacity="0.6"
                                transform="rotate(45 22 195)" />
                        </motion.g>
                    </>
                )}

                {/* ── Central 3D sphere ── */}
                <motion.g
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                    style={{ originX: `${cx}px`, originY: `${cy}px` }}>
                    {/* Shadow */}
                    <ellipse cx={cx} cy={cy + (compact ? 28 : 56)}
                        rx={compact ? 26 : 48} ry={compact ? 6 : 12}
                        fill="black" opacity="0.25" />
                    {/* Sphere */}
                    <circle cx={cx} cy={cy} r={compact ? 26 : 50} fill="url(#sphereGrad)" filter="url(#glow)" />
                    {/* Primary specular */}
                    <ellipse cx={cx - (compact ? 8 : 15)} cy={cy - (compact ? 8 : 16)}
                        rx={compact ? 7 : 14} ry={compact ? 4 : 8}
                        fill="white" opacity="0.28" transform={`rotate(-30 ${cx - (compact ? 8 : 15)} ${cy - (compact ? 8 : 16)})`} />
                    {/* Secondary specular (small) */}
                    <circle cx={cx + (compact ? 10 : 20)} cy={cy - (compact ? 12 : 22)}
                        r={compact ? 2 : 4} fill="white" opacity="0.18" />
                </motion.g>

                {/* ── Rx symbol on sphere ── */}
                {!compact && (
                    <motion.g
                        animate={{ opacity: [0.65, 1, 0.65] }}
                        transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}>
                        <text x={cx - 16} y={cy + 10}
                            fontFamily="Georgia, serif" fontSize="36" fontStyle="italic" fontWeight="bold"
                            fill="white" opacity="0.75" letterSpacing="-1">
                            Rx
                        </text>
                    </motion.g>
                )}

                {/* ── Particle field ── */}
                {!compact && (
                    <>
                        {[
                            { x: 18, y: 45, r: 2, d: 5.2 },
                            { x: size - 22, y: 55, r: 1.5, d: 7.8 },
                            { x: 30, y: 210, r: 1.5, d: 6.1 },
                            { x: size - 15, y: 220, r: 2, d: 9 },
                            { x: 55, y: 20, r: 1, d: 4.5 },
                            { x: size - 60, y: 255, r: 1, d: 8.3 },
                        ].map((p, i) => (
                            <motion.circle key={i} cx={p.x} cy={p.y} r={p.r}
                                fill="#A5B4FC"
                                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: p.d, ease: 'easeInOut', delay: i * 1.1 }} />
                        ))}
                    </>
                )}
            </svg>
        </div>
    );
};

// ─── Form input ───────────────────────────────────────────────────
// BUG FIX: removed unused accentColor prop, removed style={{ boxShadow: undefined }}
const FormInput = ({ icon, type, placeholder, value, onChange, onFocus, onBlur, required, isValid, rightSlot }: {
    icon: React.ReactNode; type: string; placeholder?: string; value: string;
    onChange: (v: string) => void; onFocus?: () => void; onBlur?: () => void;
    required?: boolean; isValid?: boolean; rightSlot?: React.ReactNode;
}) => (
    <div className={`group flex items-center gap-3.5 px-4 py-[16px] border rounded-2xl transition-all duration-200
        ${isValid
            ? 'border-emerald-300 bg-emerald-50/40 shadow-sm shadow-emerald-100'
            : 'bg-slate-50/80 border-slate-200/80 focus-within:border-indigo-400/70 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-indigo-100/80'
        }`}>
        <span className="text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200 flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {icon}
        </span>
        <input
            style={{ fontSize: '16px' }}
            type={type} placeholder={placeholder} value={value} required={required}
            onChange={e => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur}
            className="flex-1 bg-transparent outline-none text-slate-800 font-medium placeholder:text-slate-400/70 placeholder:font-normal"
        />
        {rightSlot}
        {isValid && !rightSlot && (
            <motion.span className="text-emerald-500 text-sm font-bold flex-shrink-0"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}>✓</motion.span>
        )}
    </div>
);

const LegalCheckbox = ({ id, checked, onChange, children, required, accentGrad }: any) => (
    <label htmlFor={id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 select-none
        ${checked ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'}`}>
        <div className="relative flex-shrink-0 mt-0.5">
            <input id={id} type="checkbox" required={required} checked={checked}
                onChange={e => onChange(e.target.checked)} className="sr-only" />
            <motion.div
                animate={checked
                    ? { background: accentGrad || 'linear-gradient(135deg,#6366F1,#7C3AED)', borderColor: '#6366F1' }
                    : { background: '#fff', borderColor: '#cbd5e1' }}
                className="w-4 h-4 rounded-[4px] border-2 flex items-center justify-center">
                <AnimatePresence>
                    {checked && (
                        <motion.svg key="check" viewBox="0 0 10 8" className="w-2.5 h-2"
                            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                            <polyline points="1,4 3.5,6.5 9,1" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
        <span className="text-[12px] leading-relaxed text-slate-600 font-medium">{children}</span>
    </label>
);

const ForgotPasswordModal = ({ onClose }: { onClose: () => void }) => {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });
            if (error) throw error;
            setSent(true); toast.success('Reset link sent — check your inbox.');
        } catch (err: any) { toast.error(err.message); }
        finally { setLoading(false); }
    };
    return (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                initial={{ scale: 0.94, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.94, y: 16, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
                <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right,#6366F1,#8B5CF6,#A78BFA)' }} />
                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Reset password</h2>
                        <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    {sent ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-3">📬</div>
                            <p className="text-slate-700 font-semibold text-sm">Check your inbox</p>
                            <p className="text-slate-400 text-xs mt-1">We sent a reset link to <strong>{email}</strong></p>
                            <button onClick={onClose} className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                Back to sign in
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-4">
                            <p className="text-slate-500 text-[13px]">Enter your email and we'll send a secure reset link.</p>
                            <FormInput icon={<Mail size={16} />} type="email" placeholder="Email address" value={email} required
                                onChange={setEmail} isValid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} />
                            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.975 }}
                                className="w-full text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg,#6366F1 0%,#7C3AED 100%)' }}>
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Send reset link'}
                            </motion.button>
                        </form>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Theme tokens ─────────────────────────────────────────────────
const THEME = {
    doctor: {
        // Deep space — dramatic near-black with indigo/violet rays, not boring teal
        panelBg: 'linear-gradient(160deg, #05060F 0%, #0D0E2A 40%, #0A0C22 70%, #030408 100%)',
        spotlight: 'radial-gradient(ellipse 60% 70% at 48% 58%, rgba(99,102,241,0.28) 0%, transparent 75%)',
        glowTR: 'radial-gradient(circle at top right, rgba(139,92,246,0.22) 0%, transparent 55%)',
        glowBL: 'radial-gradient(circle at bottom left, rgba(67,56,202,0.15) 0%, transparent 60%)',
        logoBg: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
        logoShadow: '0 0 0 1px rgba(99,102,241,0.5), 0 4px 20px rgba(99,102,241,0.4)',
        logoBlur: '#6366F1',
        accentText: 'rgba(167,139,250,0.75)',
        buttonBg: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
        dotActive: 'bg-emerald-400',
        dotNeutral: 'bg-indigo-400',
        dotSad: 'bg-red-400',
        tagline: 'Clinic is ready',
        phrase: 'Automation for a Healthy,\nHassle-Free Practice.',
        sub: 'Built for doctors who care about every detail.',
        switchLabel: 'Doctor Portal',
        switchIcon: <Stethoscope size={13} />,
        mobileA: '#1e1b4b',
        mobileB: '#312e81',
    },
    pharmacy: {
        // Midnight black with electric violet/indigo — premium tech feel
        panelBg: 'linear-gradient(160deg, #030308 0%, #0A0920 40%, #08071C 70%, #020207 100%)',
        spotlight: 'radial-gradient(ellipse 55% 65% at 50% 55%, rgba(79,70,229,0.30) 0%, transparent 75%)',
        glowTR: 'radial-gradient(circle at top right, rgba(124,58,237,0.20) 0%, transparent 55%)',
        glowBL: 'radial-gradient(circle at bottom left, rgba(55,48,163,0.18) 0%, transparent 60%)',
        logoBg: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        logoShadow: '0 0 0 1px rgba(79,70,229,0.5), 0 4px 20px rgba(79,70,229,0.4)',
        logoBlur: '#4F46E5',
        accentText: 'rgba(196,181,253,0.80)',
        buttonBg: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        dotActive: 'bg-violet-400',
        dotNeutral: 'bg-indigo-400',
        dotSad: 'bg-red-400',
        tagline: 'Pharmacy is ready',
        phrase: 'Precision Dispensing,\nEvery Prescription.',
        sub: 'Your clinic-connected pharmacy portal.',
        switchLabel: 'Pharmacy Portal',
        switchIcon: <Package size={13} />,
        mobileA: '#0A0920',
        mobileB: '#1e1b4b',
    },
} as const;

// ─── LoginPage ────────────────────────────────────────────────────
export const LoginPage = ({ onNavigate }: { onNavigate?: (v: any) => void }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedSignupMode = searchParams.get('mode') === 'signup' || searchParams.get('signup') === '1';

    const [portalMode, setPortalMode] = useState<PortalMode>(
        searchParams.get('portal') === 'pharmacy' ? 'pharmacy' : 'doctor',
    );
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(requestedSignupMode && searchParams.get('portal') !== 'pharmacy');
    const [error, setError] = useState<string | null>(null);
    const [emotion, setEmotion] = useState('idle');
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showForgot, setShowForgot] = useState(false);

    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [acceptedAge, setAcceptedAge] = useState(false);
    const [acceptedLoginTerms, setAcceptedLoginTerms] = useState(false);

    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const T = THEME[portalMode];

    // Redirect existing pharmacy sessions
    useEffect(() => {
        const check = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const metaRole = session.user.user_metadata?.role as string | undefined;
            const profile = metaRole === 'pharmacy_staff'
                ? await syncAndFetchPharmacyProfile(session.user.id)
                : await fetchProfileRole(session.user.id);
            const role = profile?.role ?? metaRole;

            if (role === 'pharmacy_staff') {
                navigate('/pharmacy-portal', { replace: true });
                return;
            }

            navigate('/app', { replace: true });
        };
        check();
    }, [navigate]);

    useEffect(() => {
        const requestedPortalMode = searchParams.get('portal') === 'pharmacy' ? 'pharmacy' : 'doctor';
        setPortalMode(prev => (prev === requestedPortalMode ? prev : requestedPortalMode));
        setIsSignUp(requestedPortalMode === 'doctor' && requestedSignupMode);
    }, [searchParams]);

    const switchPortal = (mode: PortalMode) => {
        navigate(mode === 'pharmacy' ? '/login?portal=pharmacy' : '/login', { replace: true });
        setPortalMode(mode);
        setError(null);
        setEmotion('idle');
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        setAcceptedLoginTerms(false);
    };

    const focusedFieldRef = useRef(focusedField);
    useEffect(() => { focusedFieldRef.current = focusedField; }, [focusedField]);

    const resetIdle = useCallback(() => {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        if (focusedFieldRef.current === 'password') return;
        idleTimer.current = setTimeout(() => setEmotion('idle'), 12000);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resetIdle, { passive: true });
        resetIdle();
        return () => {
            window.removeEventListener('mousemove', resetIdle);
            if (idleTimer.current) clearTimeout(idleTimer.current);
        };
    }, [resetIdle]);

    useEffect(() => {
        if (focusedField === 'password') { setEmotion('password'); return; }
        if (focusedField === 'email' && EMAIL_RE.test(email)) { setEmotion('happy'); return; }
        setEmotion(prev => (['success', 'submitting', 'sad'].includes(prev)) ? prev : 'idle');
    }, [focusedField, email]);

    const clearForm = () => {
        setEmail(''); setPassword(''); setFirstName(''); setLastName('');
        setAcceptedTerms(false); setAcceptedPrivacy(false); setAcceptedAge(false);
        setAcceptedLoginTerms(false); setShowPassword(false);
    };

    const allSignUpLegal = acceptedTerms && acceptedPrivacy && acceptedAge;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (isSignUp && !allSignUpLegal) {
            const msg = 'Please accept all required agreements.';
            setError(msg); toast.error(msg); return;
        }
        if (!isSignUp && !acceptedLoginTerms) {
            const msg = 'Please agree to the Terms and Privacy Policy.';
            setError(msg); toast.error(msg); return;
        }

        setLoading(true);
        setEmotion('submitting');

        try {
            if (isSignUp) {
                if (!firstName.trim()) throw new Error('First name is required.');
                const { data, error: err } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
                            consent_terms_at: new Date().toISOString(),
                            consent_privacy_at: new Date().toISOString(),
                        },
                    },
                });
                if (err) throw err;
                setEmotion('success');
                if (!data.session) {
                    toast.success('Account created! Check your email to confirm.');
                    clearForm();
                    setTimeout(() => { setEmotion('idle'); setIsSignUp(false); }, 3500);
                } else {
                    const doctorAccount = await ensureDoctorClinicSetup(data.user);
                    if (!doctorAccount.clinic?.id) {
                        throw new Error('We could not initialize your clinic workspace yet. Please try again.');
                    }

                    toast.success('Account created! Let’s finish your onboarding.');
                    navigate('/onboarding', { replace: true });
                    return;
                }
            } else {
                const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
                if (err) throw err;

                if (data.user && !data.user.user_metadata?.full_name) {
                    const base = email.split('@')[0];
                    await supabase.auth.updateUser({
                        data: { full_name: base.charAt(0).toUpperCase() + base.slice(1), first_name: base },
                    });
                }

                const metaRole = data.user.user_metadata?.role as string | undefined;
                const profile = (portalMode === 'pharmacy' || metaRole === 'pharmacy_staff')
                    ? await syncAndFetchPharmacyProfile(data.user.id)
                    : await fetchProfileRole(data.user.id);
                const effectiveRole = profile?.role ?? metaRole;

                setEmotion('success');

                if (portalMode === 'pharmacy') {
                    if (effectiveRole !== 'pharmacy_staff') {
                        await supabase.auth.signOut();
                        setEmotion('sad');
                        const msg = "This is a doctor account. Switch to 'Doctor Portal' to sign in.";
                        setError(msg); toast.error(msg);
                        setTimeout(() => setEmotion('idle'), 3500);
                        return;
                    }
                    if (!profile?.pharmacy_id) {
                        await supabase.auth.signOut();
                        setEmotion('sad');
                        const msg = 'Your pharmacy account is missing its profile link. Please sign in again or relink the pharmacy from the doctor portal.';
                        setError(msg); toast.error(msg);
                        setTimeout(() => setEmotion('idle'), 3500);
                        return;
                    }
                    toast.success('Welcome! Opening pharmacy portal…');
                    setTimeout(() => navigate('/pharmacy-portal', { replace: true }), 700);
                } else {
                    if (effectiveRole === 'pharmacy_staff') {
                        await supabase.auth.signOut();
                        setEmotion('sad');
                        const msg = "This is a pharmacy account. Switch to 'Pharmacy Portal' to sign in.";
                        setError(msg); toast.error(msg);
                        setTimeout(() => setEmotion('idle'), 3500);
                        return;
                    }
                    toast.success('Signed in!');
                    setTimeout(() => navigate('/app', { replace: true }), 350);
                    return;
                }
            }
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
            setEmotion('sad');
            setTimeout(() => setEmotion('idle'), 3500);
        } finally {
            setLoading(false);
        }
    };

    const onFocus = (f: string) => { setFocusedField(f); resetIdle(); };
    const onBlur = () => setFocusedField(null);
    const emailValid = EMAIL_RE.test(email);

    const submitDisabled =
        loading ||
        emotion === 'success' ||
        (isSignUp && !allSignUpLegal) ||
        (!isSignUp && !acceptedLoginTerms);

    const emotionLabel = ({
        idle: T.tagline,
        happy: 'Looking good',
        sad: 'Check your credentials',
        password: 'Privacy mode',
        submitting: 'Verifying access',
        success: 'Access granted',
    } as Record<string, string>)[emotion] ?? T.tagline;

    const dotColor = emotion === 'sad'
        ? T.dotSad
        : (emotion === 'success' || emotion === 'happy')
            ? T.dotActive
            : T.dotNeutral;

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row">

            {/* ── Left panel ── */}
            <div className="hidden md:flex md:w-1/2 flex-col relative overflow-hidden" style={{ minHeight: '100vh' }}>

                {/* Layered backgrounds — fade between portals */}
                <motion.div className="absolute inset-0" style={{ background: THEME.doctor.panelBg }}
                    animate={{ opacity: portalMode === 'doctor' ? 1 : 0 }} transition={{ duration: 0.55 }} />
                <motion.div className="absolute inset-0" style={{ background: THEME.pharmacy.panelBg }}
                    animate={{ opacity: portalMode === 'pharmacy' ? 1 : 0 }} transition={{ duration: 0.55 }} />

                {/* Fine dot texture */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

                {/* Spotlight glow */}
                <motion.div className="absolute inset-0 pointer-events-none"
                    animate={{ background: T.spotlight }} transition={{ duration: 0.55 }} />
                <motion.div className="absolute inset-0 pointer-events-none"
                    animate={{ background: T.glowTR }} transition={{ duration: 0.55 }} />
                <motion.div className="absolute inset-0 pointer-events-none"
                    animate={{ background: T.glowBL }} transition={{ duration: 0.55 }} />

                {/* Scanline overlay for depth */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 4px)' }} />

                {/* Logo */}
                <div className="flex-shrink-0 px-9 pt-9 flex items-center gap-3 z-10">
                    <Logo variant="full" usage="navbar" theme="light" />
                    <div className="flex flex-col">
                        <motion.span className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                            animate={{ color: T.accentText }} transition={{ duration: 0.4 }}>
                            {portalMode === 'pharmacy' ? 'Pharmacy Portal' : 'Advanced Healthtech'}
                        </motion.span>
                    </div>
                </div>

                {/* Visual stage */}
                <div className="flex-1 flex flex-col items-center justify-center w-full px-8 z-10">
                    <div className="w-full max-w-[340px]">
                        <AnimatePresence mode="wait">
                            {portalMode === 'doctor' ? (
                                <motion.div key="doctor"
                                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35 }}>
                                    <DoctorStage emotion={emotion} />
                                </motion.div>
                            ) : (
                                <motion.div key="pharmacy"
                                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
                                    <PharmacyScene3D />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Status pill */}
                    <AnimatePresence mode="wait">
                        <motion.div key={emotion + portalMode}
                            className="mt-7 flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
                            <span className="relative flex h-1.5 w-1.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${dotColor}`} />
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
                            </span>
                            <span className="text-[11px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                {emotionLabel}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Tagline */}
                <div className="flex-shrink-0 px-9 pb-10 z-10">
                    <AnimatePresence mode="wait">
                        <motion.div key={portalMode}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                            <p className="text-[15px] font-bold leading-snug text-white/80 mb-1 whitespace-pre-line">{T.phrase}</p>
                            <p className="text-[12px] font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.28)' }}>{T.sub}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Right panel ── */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center min-h-screen px-4 md:px-5 py-6 md:py-12 relative"
                style={{ background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                <motion.div className="w-full max-w-[420px]"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28 }}>

                    {/* Mobile top */}
                    <div className="flex md:hidden flex-col items-center mb-6">
                        <div className="flex items-center gap-2.5 mb-5 self-start">
                            <Logo variant="icon" usage="loginPage" theme="dark" />
                            <span className="font-black text-xl tracking-tight text-slate-900">NirogOS</span>
                        </div>
                        <div className="w-full rounded-2xl overflow-hidden mb-2 relative" style={{ minHeight: '110px' }}>
                            <motion.div className="absolute inset-0"
                                animate={{ opacity: portalMode === 'doctor' ? 1 : 0 }} transition={{ duration: 0.4 }}
                                style={{ background: `linear-gradient(135deg, ${THEME.doctor.mobileA} 0%, ${THEME.doctor.mobileB} 50%, ${THEME.doctor.mobileA} 100%)` }} />
                            <motion.div className="absolute inset-0"
                                animate={{ opacity: portalMode === 'pharmacy' ? 1 : 0 }} transition={{ duration: 0.4 }}
                                style={{ background: `linear-gradient(135deg, ${THEME.pharmacy.mobileA} 0%, ${THEME.pharmacy.mobileB} 50%, ${THEME.pharmacy.mobileA} 100%)` }} />
                            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                                style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                            <div className="relative z-10 flex justify-center items-end" style={{ height: '110px' }}>
                                <AnimatePresence mode="wait">
                                    {portalMode === 'doctor' ? (
                                        <motion.div key="doc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            <DoctorStage emotion={emotion} compact />
                                        </motion.div>
                                    ) : (
                                        <motion.div key="pharm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            <PharmacyScene3D compact />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-3xl overflow-hidden"
                        style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                        <motion.div className="h-[3px] w-full" animate={{ background: T.buttonBg }} transition={{ duration: 0.4 }} />

                        <div className="px-5 pt-5 pb-5 md:px-8 md:pt-7 md:pb-8">

                            {/* Portal toggle */}
                            <div className="relative flex bg-slate-100 rounded-2xl p-1 mb-6">
                                <motion.div className="absolute top-1 bottom-1 rounded-xl"
                                    animate={{
                                        left: portalMode === 'doctor' ? '4px' : 'calc(50% + 2px)',
                                        width: 'calc(50% - 6px)',
                                        background: T.buttonBg,
                                    }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 35 }}
                                />
                                {(['doctor', 'pharmacy'] as PortalMode[]).map(mode => (
                                    <button key={mode} onClick={() => switchPortal(mode)}
                                        className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-colors duration-200 ${portalMode === mode ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {THEME[mode].switchIcon}
                                        {THEME[mode].switchLabel}
                                    </button>
                                ))}
                            </div>

                            {/* Heading */}
                            <div className="mb-5">
                                <AnimatePresence mode="wait">
                                    <motion.div key={`${isSignUp}-${portalMode}`}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                                        <h1 className="text-[24px] font-black text-slate-900 tracking-[-0.02em] leading-tight">
                                            {isSignUp ? 'Create your account' : 'Welcome back'}
                                        </h1>
                                        <p className="mt-1.5 text-slate-400 text-[13px] font-medium leading-relaxed">
                                            {portalMode === 'pharmacy'
                                                ? 'Sign in to your pharmacy dashboard.'
                                                : isSignUp
                                                    ? 'Set up your NirogOS workspace in seconds.'
                                                    : 'Sign in to manage your NirogOS clinic.'}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Error banner */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div className="mb-4 flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-2xl"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}>
                                        <span className="text-base leading-none mt-0.5">⚠️</span>
                                        <span className="text-red-600 font-medium text-[13px]">{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleAuth} className="space-y-3">
                                {/* Name fields — sign-up, doctor only */}
                                <AnimatePresence>
                                    {isSignUp && portalMode === 'doctor' && (
                                        <motion.div className="grid grid-cols-2 gap-3"
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                                            <FormInput icon={<User size={16} />} type="text" placeholder="First name"
                                                value={firstName} required onChange={setFirstName}
                                                onFocus={() => onFocus('name')} onBlur={onBlur} />
                                            <FormInput icon={<User size={16} />} type="text" placeholder="Last name"
                                                value={lastName} onChange={setLastName}
                                                onFocus={() => onFocus('name')} onBlur={onBlur} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <FormInput icon={<Mail size={16} />} type="email" placeholder="Email address"
                                    value={email} required
                                    onChange={v => { setEmail(v); resetIdle(); }}
                                    onFocus={() => onFocus('email')} onBlur={onBlur}
                                    isValid={focusedField === 'email' && emailValid} />

                                <FormInput icon={<Lock size={16} />}
                                    type={showPassword ? 'text' : 'password'} placeholder="Password"
                                    value={password} required
                                    onChange={v => { setPassword(v); resetIdle(); }}
                                    onFocus={() => onFocus('password')} onBlur={onBlur}
                                    rightSlot={
                                        <button type="button" onClick={() => setShowPassword(p => !p)}
                                            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5" tabIndex={-1}>
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    }
                                />

                                {!isSignUp && (
                                    <div className="flex justify-end -mt-1">
                                        <button type="button" onClick={() => setShowForgot(true)}
                                            className="text-xs font-semibold hover:opacity-70 transition-opacity"
                                            style={{ color: portalMode === 'pharmacy' ? '#4F46E5' : '#6366F1' }}>
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                {/* Sign-up legal checkboxes */}
                                <AnimatePresence>
                                    {isSignUp && portalMode === 'doctor' && (
                                        <motion.div className="space-y-2 pt-1"
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="h-px flex-1 bg-slate-200" />
                                                <span className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase">Required agreements</span>
                                                <div className="h-px flex-1 bg-slate-200" />
                                            </div>
                                            <LegalCheckbox id="accept-terms" checked={acceptedTerms} onChange={setAcceptedTerms} required>
                                                I agree to the <Link to="/terms" target="_blank" className="text-indigo-600 font-bold hover:underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>Terms of Service</Link> and confirm I am authorised to use this platform.
                                            </LegalCheckbox>
                                            <LegalCheckbox id="accept-privacy" checked={acceptedPrivacy} onChange={setAcceptedPrivacy} required>
                                                I accept the <Link to="/privacy" target="_blank" className="text-indigo-600 font-bold hover:underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>Privacy Policy / DPDP Act</Link>, including how patient data is processed.
                                            </LegalCheckbox>
                                            <LegalCheckbox id="accept-age" checked={acceptedAge} onChange={setAcceptedAge} required>
                                                I am 18+ and a licensed healthcare professional or authorised administrator.
                                            </LegalCheckbox>
                                            <div className="pt-1">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Consent</span>
                                                    <span className="text-[10px] font-bold text-indigo-500">
                                                        {[acceptedTerms, acceptedPrivacy, acceptedAge].filter(Boolean).length} / 3
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <motion.div className="h-full rounded-full"
                                                        style={{ background: 'linear-gradient(to right,#6366F1,#8B5CF6)' }}
                                                        animate={{ width: `${([acceptedTerms, acceptedPrivacy, acceptedAge].filter(Boolean).length / 3) * 100}%` }}
                                                        transition={{ type: 'spring', stiffness: 200, damping: 24 }} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Sign-in legal checkbox */}
                                <AnimatePresence>
                                    {!isSignUp && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                                            <LegalCheckbox id="accept-login-terms" checked={acceptedLoginTerms}
                                                onChange={setAcceptedLoginTerms} required
                                                accentGrad={portalMode === 'pharmacy' ? 'linear-gradient(135deg,#4F46E5,#7C3AED)' : undefined}>
                                                I agree to the NirogOS{' '}
                                                <Link to="/terms" target="_blank" className="font-bold hover:underline"
                                                    style={{ color: portalMode === 'pharmacy' ? '#4F46E5' : '#6366F1' }}
                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}>Terms</Link>
                                                {' '}and{' '}
                                                <Link to="/privacy" target="_blank" className="font-bold hover:underline"
                                                    style={{ color: portalMode === 'pharmacy' ? '#4F46E5' : '#6366F1' }}
                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}>Privacy Policy</Link>.
                                            </LegalCheckbox>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Pharmacy note */}
                                <AnimatePresence>
                                    {portalMode === 'pharmacy' && !isSignUp && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex items-start gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                                            <Package size={12} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-indigo-700 font-medium">
                                                Pharmacy accounts are created by your clinic administrator.
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Submit */}
                                <motion.button type="submit" disabled={submitDisabled}
                                    whileTap={{ scale: 0.975 }}
                                    whileHover={!submitDisabled ? { scale: 1.008, boxShadow: `0 8px 28px ${portalMode === 'pharmacy' ? 'rgba(79,70,229,0.32)' : 'rgba(99,102,241,0.32)'}` } : {}}
                                    className="w-full text-white py-[15px] rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2.5 mt-1 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                    style={{ background: T.buttonBg }}>
                                    {loading
                                        ? <Loader2 size={18} className="animate-spin" />
                                        : emotion === 'success'
                                            ? <>✓ Done</>
                                            : <>{isSignUp ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></>}
                                </motion.button>

                                <div className="flex items-center justify-center gap-1.5 pt-1">
                                    <ShieldCheck size={12} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-500 font-medium">
                                        256-bit Encrypted &amp; Secure • Built for Indian Healthcare
                                    </span>
                                </div>
                            </form>

                            {/* Sign-in / sign-up toggle — doctor only */}
                            <AnimatePresence>
                                {portalMode === 'doctor' && (
                                    <motion.div className="mt-5 text-center"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <span className="text-slate-400 text-[13px]">
                                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                                        </span>{' '}
                                        <button type="button"
                                            onClick={() => { setIsSignUp(p => !p); setError(null); setEmotion('idle'); setAcceptedLoginTerms(false); }}
                                            className="text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                            {isSignUp ? 'Sign in' : 'Create one'}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-4">
                                <Link to="/refund-policy" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Refund Policy</Link>
                                <span className="text-slate-200 text-xs">|</span>
                                <Link to="/support" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Contact Support</Link>
                            </div>
                            {portalMode === 'pharmacy' && (
                                <div className="mt-3 text-center text-[12px] text-slate-500">
                                    New pharmacy?{' '}
                                    <Link
                                        to="/pharmacy/signup"
                                        className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        Register here →
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>

            <AnimatePresence>
                {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default LoginPage;
