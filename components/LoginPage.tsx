// LoginPage.jsx — NirogOS rebranded, DPDP-compliant, fully self-contained
// Requires: react, framer-motion, lucide-react, react-hot-toast, react-router-dom
// Supabase is mocked below — swap the mock for your real `../services/db` import.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mail, Lock, Loader2, ArrowRight, User, Pill, Eye, EyeOff, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { supabase } from '../services/db';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES  (JSDoc for IDE hints without TypeScript)
// ─────────────────────────────────────────────────────────────────────────────
/** @typedef {'idle'|'happy'|'sad'|'password'|'submitting'|'success'} Emotion */

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function useMousePosition() {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const h = (e) => {
            const p = e.touches ? e.touches[0] : e;
            setPos({ x: p.clientX, y: p.clientY });
        };
        window.addEventListener('mousemove', h, { passive: true });
        window.addEventListener('touchmove', h, { passive: true });
        return () => {
            window.removeEventListener('mousemove', h);
            window.removeEventListener('touchmove', h);
        };
    }, []);
    return pos;
}

function usePupilOffset(mouse, eyeRef, maxOffset, blind) {
    const sx = useSpring(0, { stiffness: 90, damping: 22 });
    const sy = useSpring(0, { stiffness: 90, damping: 22 });

    useEffect(() => {
        if (blind || !eyeRef.current) {
            sx.set(0);
            sy.set(0);
            return;
        }
        const rect = eyeRef.current.getBoundingClientRect();
        const dx = mouse.x - (rect.left + rect.width / 2);
        const dy = mouse.y - (rect.top + rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const factor = Math.min(dist, 100) / 100;
        sx.set((dx / dist) * maxOffset * factor);
        sy.set((dy / dist) * maxOffset * factor);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mouse.x, mouse.y, blind, maxOffset]);

    return { sx, sy };
}

// ─────────────────────────────────────────────────────────────────────────────
// ABSTRACT EYE
// ─────────────────────────────────────────────────────────────────────────────
const AbstractEye = ({
    cx, cy, r, mouse, emotion,
    sclera = 'white',
    pupil = '#1e1b4b',
}) => {
    const ref = useRef(null);
    const pr = r * 0.45;
    const isBlind = emotion === 'password';
    const isSad = emotion === 'sad';

    const { sx, sy } = usePupilOffset(mouse, ref, r * 0.42, isBlind || isSad);

    const px = useTransform(sx, v => cx + v);
    const py = useTransform(sy, v => cy + v);
    const shineX = useTransform(sx, v => cx + v + pr * 0.4);
    const shineY = useTransform(sy, v => cy + v - pr * 0.4);

    return (
        <g>
            <circle ref={ref} cx={cx} cy={cy} r={r} fill={sclera} />
            {!isBlind && !isSad && (
                <motion.ellipse
                    cx={cx} cy={cy} rx={r} ry={r * 0.08}
                    fill={sclera}
                    animate={{ ry: [r * 0.08, r, r * 0.08] }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.24,
                        repeatDelay: 4.8 + Math.random() * 2,
                        ease: 'easeInOut',
                        times: [0, 0.5, 1],
                    }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                />
            )}
            <AnimatePresence>
                {isBlind && (
                    <motion.rect
                        key="blind"
                        x={cx - r} y={cy - r}
                        width={r * 2} height={r * 2}
                        rx={r}
                        fill={sclera}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        exit={{ scaleY: 0 }}
                        style={{ transformOrigin: `${cx}px ${cy}px` }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    />
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

// ─────────────────────────────────────────────────────────────────────────────
// ABSTRACT MOUTH
// ─────────────────────────────────────────────────────────────────────────────
const AbstractMouth = ({ cx, cy, w, emotion, color }) => {
    const h = w * 0.35;
    const d =
        emotion === 'sad'
            ? `M${cx - w} ${cy + h} Q${cx} ${cy - h * 0.5} ${cx + w} ${cy + h}`
            : emotion === 'password'
                ? `M${cx - w * 0.7} ${cy} L${cx + w * 0.7} ${cy}`
                : `M${cx - w} ${cy} Q${cx} ${cy + h * 1.2} ${cx + w} ${cy}`;

    return (
        <AnimatePresence mode="wait">
            <motion.path
                key={d} d={d}
                stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0 }}
                transition={{ duration: 0.28 }}
            />
        </AnimatePresence>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const CharPurple = ({ mouse, emotion }) => {
    const isSad = emotion === 'sad';
    return (
        <g>
            <rect x="8" y="44" width="64" height="108" rx="24" fill="#6D28D9" />
            <rect x="8" y="44" width="32" height="108" rx="24" fill="#7C3AED" opacity="0.45" />
            <ellipse cx="30" cy="100" rx="14" ry="20" fill="#8B5CF6" opacity="0.25" />
            <rect x="14" y="142" width="22" height="16" rx="8" fill="#4C1D95" />
            <rect x="44" y="142" width="22" height="16" rx="8" fill="#4C1D95" />
            <rect x="26" y="36" width="28" height="16" rx="8" fill="#7C3AED" />
            <motion.g
                animate={isSad ? { rotateX: 20, y: 8 } : { rotateX: 0, y: 0 }}
                transition={
                    isSad
                        ? { type: 'spring', stiffness: 140, damping: 14, delay: 0.05 }
                        : { type: 'spring', stiffness: 160, damping: 18 }
                }
                style={{ originX: '40px', originY: '28px' }}
            >
                {isSad ? (
                    <motion.g
                        animate={{ rotateZ: [-3, 3, -2, 2, 0] }}
                        transition={{ duration: 0.55, times: [0, 0.25, 0.5, 0.75, 1] }}
                    >
                        <rect x="10" y="4" width="60" height="52" rx="22" fill="#7C3AED" />
                        <rect x="10" y="4" width="28" height="52" rx="22" fill="#8B5CF6" opacity="0.4" />
                        <AbstractEye cx={28} cy={28} r={9} mouse={mouse} emotion={emotion} />
                        <AbstractEye cx={52} cy={28} r={9} mouse={mouse} emotion={emotion} />
                        <AbstractMouth cx={40} cy={44} w={10} emotion={emotion} color="#DDD6FE" />
                    </motion.g>
                ) : (
                    <>
                        <rect x="10" y="4" width="60" height="52" rx="22" fill="#7C3AED" />
                        <rect x="10" y="4" width="28" height="52" rx="22" fill="#8B5CF6" opacity="0.4" />
                        <AbstractEye cx={28} cy={28} r={9} mouse={mouse} emotion={emotion} />
                        <AbstractEye cx={52} cy={28} r={9} mouse={mouse} emotion={emotion} />
                        <AbstractMouth cx={40} cy={44} w={10} emotion={emotion} color="#DDD6FE" />
                    </>
                )}
            </motion.g>
            <rect x="-6" y="64" width="18" height="44" rx="9" fill="#6D28D9" />
            <rect x="68" y="64" width="18" height="44" rx="9" fill="#6D28D9" />
            <ellipse cx="1" cy="110" rx="9" ry="8" fill="#5B21B6" />
            <ellipse cx="79" cy="110" rx="9" ry="8" fill="#5B21B6" />
        </g>
    );
};

const CharOrange = ({ mouse, emotion }) => (
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

const CharDark = ({ mouse, emotion }) => (
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

const CharYellow = ({ mouse, emotion }) => (
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

// ─────────────────────────────────────────────────────────────────────────────
// BREATHING WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
const Breathing = ({ delay = 0, range = 3, duration = 3.5, children, className }: { delay?: number; range?: number; duration?: number; children: React.ReactNode; className?: string }) => (
    <motion.div
        className={className}
        animate={{ y: [0, -range, 0] }}
        transition={{ repeat: Infinity, duration, ease: [0.45, 0, 0.55, 1], delay }}
    >
        {children}
    </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER STAGE
// ─────────────────────────────────────────────────────────────────────────────
const CharacterStage = ({ emotion, compact = false }) => {
    const mouse = useMousePosition();

    if (compact) {
        return (
            <div className="relative flex flex-col items-center w-full" style={{ height: '100px' }}>
                <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-2">
                    <div
                        className="w-4/5 h-4/5 rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 72%)' }}
                    />
                </div>
                <div
                    className="absolute bottom-0 left-1/2 flex items-end justify-center gap-2"
                    style={{ transform: 'translateX(-50%) scale(0.46)', transformOrigin: 'bottom center' }}
                >
                    <Breathing delay={0} range={3} duration={3.8}>
                        <svg viewBox="0 0 80 160" className="w-[78px] h-[156px] overflow-visible drop-shadow-lg">
                            <CharPurple mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                    <Breathing delay={0.9} range={2.5} duration={4.1}>
                        <svg viewBox="0 0 76 118" className="w-[68px] h-[108px] overflow-visible drop-shadow-lg">
                            <CharOrange mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                    <Breathing delay={1.6} range={3.5} duration={3.4}>
                        <svg viewBox="0 0 60 134" className="w-[50px] h-[112px] overflow-visible drop-shadow-lg">
                            <CharDark mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                    <Breathing delay={0.45} range={2} duration={4.4}>
                        <svg viewBox="0 0 76 116" className="w-[58px] h-[88px] overflow-visible drop-shadow-lg">
                            <CharYellow mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </div>
                <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-3 w-3/5 rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%)' }}
                />
            </div>
        );
    }

    return (
        <div className="relative flex flex-col items-center w-full">
            <AnimatePresence>
                {(emotion === 'password' || emotion === 'sad' || emotion === 'success') && (
                    <motion.div
                        className="absolute -top-8 inset-x-0 flex justify-center z-20"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    >
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border backdrop-blur-sm ${emotion === 'password'
                            ? 'bg-slate-800/80 text-slate-200 border-slate-600'
                            : emotion === 'sad'
                                ? 'bg-red-950/80 text-red-300 border-red-800'
                                : 'bg-violet-900/80 text-violet-200 border-violet-700'
                            }`}>
                            {emotion === 'password' && '🙈 Discretion activated'}
                            {emotion === 'sad' && '😕 Check credentials and try again'}
                            {emotion === 'success' && '🎉 Welcome back!'}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-4">
                <div
                    className="w-4/5 h-4/5 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 72%)' }}
                />
            </div>

            <div className="flex items-end justify-center gap-3 sm:gap-5 relative pt-6">
                <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}>
                    <Breathing delay={0} range={3} duration={3.8}>
                        <svg viewBox="0 0 80 160" className="w-[78px] h-[156px] sm:w-24 sm:h-48 md:w-[118px] md:h-[236px] overflow-visible drop-shadow-lg">
                            <CharPurple mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>
                <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.22 }}>
                    <Breathing delay={0.9} range={2.5} duration={4.1}>
                        <svg viewBox="0 0 76 118" className="w-[68px] h-[108px] sm:w-[80px] sm:h-[124px] md:w-24 md:h-[148px] overflow-visible drop-shadow-lg">
                            <CharOrange mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>
                <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 }}>
                    <Breathing delay={1.6} range={3.5} duration={3.4}>
                        <svg viewBox="0 0 60 134" className="w-[50px] h-[112px] sm:w-[60px] sm:h-[134px] md:w-[68px] md:h-[154px] overflow-visible drop-shadow-lg">
                            <CharDark mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>
                <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.46 }}>
                    <Breathing delay={0.45} range={2} duration={4.4}>
                        <svg viewBox="0 0 76 116" className="w-[58px] h-[88px] sm:w-[68px] sm:h-[104px] md:w-[78px] md:h-[120px] overflow-visible drop-shadow-lg">
                            <CharYellow mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>
            </div>

            <div className="relative mt-1 w-full flex justify-center">
                <div
                    className="h-4 w-4/5 rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.40) 0%, transparent 70%)' }}
                />
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM INPUT
// ─────────────────────────────────────────────────────────────────────────────
const FormInput = ({
    icon, type, placeholder, value, onChange,
    onFocus, onBlur, required, isValid, rightSlot,
}: {
    icon: React.ReactNode; type: string; placeholder?: string; value: string; onChange: (v: string) => void;
    onFocus?: () => void; onBlur?: () => void; required?: boolean; isValid?: boolean; rightSlot?: React.ReactNode;
}) => (
    <div className={`group flex items-center gap-3.5 px-4 py-[16px] border rounded-2xl transition-all duration-200 ${isValid
        ? 'border-emerald-300 bg-emerald-50/40 shadow-sm shadow-emerald-100'
        : 'bg-slate-50/80 border-slate-200/80 focus-within:border-indigo-400/70 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-indigo-100/80'
        }`}>
        <span className="text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200 flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {icon}
        </span>
        <input
            style={{ fontSize: '16px' }}
            type={type} placeholder={placeholder} value={value} required={required}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
            className="flex-1 bg-transparent outline-none text-slate-800 font-medium placeholder:text-slate-400/70 placeholder:font-normal"
        />
        {rightSlot}
        {isValid && !rightSlot && (
            <motion.span
                className="text-emerald-500 text-sm font-bold flex-shrink-0"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
                ✓
            </motion.span>
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL CHECKBOX  (shared by both sign-in and sign-up flows)
// ─────────────────────────────────────────────────────────────────────────────
const LegalCheckbox = ({ id, checked, onChange, children, required }) => (
    <label
        htmlFor={id}
        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 select-none ${checked
            ? 'border-indigo-300 bg-indigo-50/60'
            : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
            }`}
    >
        <div className="relative flex-shrink-0 mt-0.5">
            <input
                id={id} type="checkbox" required={required}
                checked={checked} onChange={e => onChange(e.target.checked)}
                className="sr-only"
            />
            <motion.div
                animate={
                    checked
                        ? { background: 'linear-gradient(135deg,#6366F1,#7C3AED)', borderColor: '#6366F1' }
                        : { background: '#fff', borderColor: '#cbd5e1' }
                }
                className="w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors"
            >
                <AnimatePresence>
                    {checked && (
                        <motion.svg
                            key="check" viewBox="0 0 10 8" className="w-2.5 h-2"
                            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        >
                            <polyline points="1,4 3.5,6.5 9,1" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
        <span className="text-[12px] leading-relaxed text-slate-600 font-medium">
            {children}
        </span>
    </label>
);

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD MODAL
// ─────────────────────────────────────────────────────────────────────────────
const ForgotPasswordModal = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });
            if (error) throw error;
            setSent(true);
            toast.success('Reset link sent — check your inbox.');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
            <motion.div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                initial={{ scale: 0.94, y: 16, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.94, y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
                <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right,#6366F1,#8B5CF6,#A78BFA)' }} />
                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Reset password</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    {sent ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-3">📬</div>
                            <p className="text-slate-700 font-semibold text-sm">Check your inbox</p>
                            <p className="text-slate-400 text-xs mt-1">
                                We sent a reset link to <strong>{email}</strong>
                            </p>
                            <button
                                onClick={onClose}
                                className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                Back to sign in
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-4">
                            <p className="text-slate-500 text-[13px]">
                                Enter your account email and we'll send you a secure reset link.
                            </p>
                            <FormInput
                                icon={<Mail size={16} />}
                                type="email" placeholder="Email address" value={email} required
                                onChange={setEmail}
                                isValid={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
                            />
                            <motion.button
                                type="submit" disabled={loading}
                                whileTap={{ scale: 0.975 }}
                                className="w-full text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg,#6366F1 0%,#7C3AED 100%)' }}
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Send reset link'}
                            </motion.button>
                        </form>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export const LoginPage = ({ onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState(null);
    const [emotion, setEmotion] = useState('idle');
    const [focusedField, setFocusedField] = useState(null);
    const [showForgotPassword, setShowForgotPassword] = useState(false);

    // ── CHANGE 2: Sign-up legal checkboxes (unchanged) ──
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [acceptedHipaa, setAcceptedHipaa] = useState(false);
    const [acceptedAge, setAcceptedAge] = useState(false);

    // ── CHANGE 3: NEW — sign-in single legal agreement checkbox ──
    const [acceptedLoginTerms, setAcceptedLoginTerms] = useState(false);

    const idleTimer = useRef(null);

    // ── RESTORE SESSION ──
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) toast.success('Restoring session…', { position: 'bottom-center' });
        });
    }, []);

    // ── IDLE TIMER ──
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

    // ── EMOTION DERIVED FROM FOCUS + EMAIL ──
    useEffect(() => {
        if (focusedField === 'password') { setEmotion('password'); return; }
        if (focusedField === 'email' && EMAIL_RE.test(email)) { setEmotion('happy'); return; }
        setEmotion(prev => (prev === 'success' || prev === 'submitting' || prev === 'sad') ? prev : 'idle');
    }, [focusedField, email]);

    // ── HELPERS ──
    const clearForm = () => {
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setAcceptedTerms(false);
        setAcceptedPrivacy(false);
        setAcceptedHipaa(false);
        setAcceptedAge(false);
        setAcceptedLoginTerms(false);
        setShowPassword(false);
    };

    const allSignUpLegalAccepted = acceptedTerms && acceptedPrivacy && acceptedHipaa && acceptedAge;

    // ── AUTH HANDLER ──
    const handleAuth = async (e) => {
        e.preventDefault();
        setError(null);

        if (isSignUp && !allSignUpLegalAccepted) {
            const msg = 'Please accept all required agreements to create an account.';
            setError(msg);
            toast.error(msg);
            return;
        }

        // ── CHANGE 4: Guard for sign-in legal checkbox ──
        if (!isSignUp && !acceptedLoginTerms) {
            const msg = 'Please agree to the Terms of Service and Privacy Policy to continue.';
            setError(msg);
            toast.error(msg);
            return;
        }

        setLoading(true);
        setEmotion('submitting');

        try {
            if (isSignUp) {
                if (!firstName.trim()) throw new Error('First name is required.');

                const { data, error: err } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
                            consent_terms_at: new Date().toISOString(),
                            consent_privacy_at: new Date().toISOString(),
                            consent_hipaa_at: new Date().toISOString(),
                        },
                    },
                });

                if (err) throw err;
                setEmotion('success');

                if (data.session) {
                    toast.success('Account created successfully!');
                } else {
                    toast.success('Account created! Check your email to confirm, then sign in.');
                    clearForm();
                    setTimeout(() => {
                        setEmotion('idle');
                        setIsSignUp(false);
                    }, 3500);
                }

            } else {
                const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
                if (err) throw err;

                if (data.user && !data.user.user_metadata?.full_name) {
                    const base = email.split('@')[0];
                    await supabase.auth.updateUser({
                        data: {
                            full_name: base.charAt(0).toUpperCase() + base.slice(1),
                            first_name: base,
                        },
                    });
                }

                setEmotion('success');
                toast.success('Signed in successfully!');
            }

        } catch (err) {
            setError(err.message);
            toast.error(err.message);
            setEmotion('sad');
            setTimeout(() => setEmotion('idle'), 3500);
        } finally {
            setLoading(false);
        }
    };

    const onFocus = (f) => { setFocusedField(f); resetIdle(); };
    const onBlur = () => setFocusedField(null);
    const emailValid = EMAIL_RE.test(email);

    // ── CHANGE 5: Updated disabled logic — sign-in also requires loginTerms ──
    const submitDisabled =
        loading ||
        emotion === 'success' ||
        (isSignUp && !allSignUpLegalAccepted) ||
        (!isSignUp && !acceptedLoginTerms);

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row">

            {/* ══════════════ LEFT PANEL ══════════════ */}
            <div
                className="hidden md:flex md:w-1/2 flex-col relative overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, #13111f 0%, #1e1b4b 35%, #1a1040 65%, #0c0f1d 100%)',
                    minHeight: '100vh',
                }}
            >
                {/* Textures */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                }} />
                <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'radial-gradient(ellipse 70% 55% at 50% 62%, rgba(99,102,241,0.18) 0%, transparent 100%)',
                }} />
                <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none" style={{
                    background: 'radial-gradient(circle at top right, rgba(139,92,246,0.14) 0%, transparent 65%)',
                }} />
                <div className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none" style={{
                    background: 'radial-gradient(circle at bottom left, rgba(59,130,246,0.09) 0%, transparent 70%)',
                }} />
                <div className="absolute top-0 inset-x-0 h-36 pointer-events-none" style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 100%)',
                }} />
                <div className="absolute bottom-0 inset-x-0 h-36 pointer-events-none" style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.32) 0%, transparent 100%)',
                }} />

                {/* ── CHANGE 6: Logo — "NirogOS" → "NirogOS" ── */}
                <div className="flex-shrink-0 px-9 pt-9 flex items-center gap-3 z-10">
                    <div className="relative">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 16px rgba(99,102,241,0.35)' }}
                        >
                            <Pill className="text-white w-5 h-5" />
                        </div>
                        <div className="absolute inset-0 rounded-xl blur-md opacity-40"
                            style={{ background: 'radial-gradient(circle, #6366F1, transparent)' }} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-[15px] tracking-tight text-white leading-none">NirogOS</span>
                        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'rgba(139,92,246,0.7)' }}>
                            Advanced Healthtech
                        </span>
                    </div>
                </div>

                {/* Characters */}
                <div className="flex-1 flex flex-col items-center justify-center w-full px-8 z-10">
                    <div className="w-full max-w-[340px]">
                        <CharacterStage emotion={emotion} />
                    </div>

                    {/* Emotion pill */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={emotion}
                            className="mt-7 flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.25 }}
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${emotion === 'sad' ? 'bg-red-400'
                                    : emotion === 'success' || emotion === 'happy' ? 'bg-emerald-400'
                                        : 'bg-indigo-400'
                                    }`} />
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${emotion === 'sad' ? 'bg-red-400'
                                    : emotion === 'success' || emotion === 'happy' ? 'bg-emerald-400'
                                        : 'bg-indigo-400'
                                    }`} />
                            </span>
                            <span className="text-[11px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>
                                {emotion === 'idle' && 'Clinic is ready'}
                                {emotion === 'happy' && 'Looking good'}
                                {emotion === 'sad' && 'Check your credentials'}
                                {emotion === 'password' && 'Privacy mode'}
                                {emotion === 'submitting' && 'Verifying access'}
                                {emotion === 'success' && 'Access granted'}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── CHANGE 7: Left panel footer — tagline injected ── */}
                <div className="flex-shrink-0 px-9 pb-10 z-10">
                    <p className="text-[15px] font-bold leading-snug text-white/80 mb-1">
                        Automation for a Healthy,<br />Hassle-Free Practice.
                    </p>
                    <p className="text-[12px] font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        Built for doctors who care about every detail.
                    </p>
                </div>
            </div>

            {/* ══════════════ RIGHT PANEL ══════════════ */}
            <div
                className="w-full md:w-1/2 flex flex-col items-center justify-center min-h-screen px-4 md:px-5 py-6 md:py-12 relative"
                style={{ background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)' }}
            >
                <motion.div
                    className="w-full max-w-[420px]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                >
                    {/* ── MOBILE TOP SECTION ── */}
                    <div className="flex md:hidden flex-col items-center mb-6">
                        {/* ── CHANGE 8: Mobile logo — "NirogOS" → "NirogOS" ── */}
                        <div className="flex items-center gap-2.5 mb-5 self-start">
                            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <Pill className="text-white w-5 h-5" />
                            </div>
                            <span className="font-black text-xl tracking-tight text-slate-900">NirogOS</span>
                        </div>

                        <div
                            className="w-full rounded-2xl overflow-hidden mb-2 relative"
                            style={{
                                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
                                minHeight: '110px',
                            }}
                        >
                            <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
                                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                                backgroundSize: '18px 18px',
                            }} />
                            <div className="absolute inset-0 pointer-events-none"
                                style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 70%, rgba(99,102,241,0.25) 0%, transparent 100%)' }} />
                            <div className="relative z-10 flex justify-center items-end" style={{ height: '110px' }}>
                                <CharacterStage emotion={emotion} compact />
                            </div>
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                                <div
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}
                                >
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${emotion === 'sad' ? 'bg-red-400'
                                            : emotion === 'success' || emotion === 'happy' ? 'bg-emerald-400'
                                                : 'bg-indigo-400'
                                            }`} />
                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${emotion === 'sad' ? 'bg-red-400'
                                            : emotion === 'success' || emotion === 'happy' ? 'bg-emerald-400'
                                                : 'bg-indigo-400'
                                            }`} />
                                    </span>
                                    <span className="text-[10px] font-semibold text-white/60 tracking-wide">
                                        {emotion === 'idle' && 'Clinic is ready'}
                                        {emotion === 'happy' && 'Looking good'}
                                        {emotion === 'sad' && 'Check credentials'}
                                        {emotion === 'password' && 'Privacy mode'}
                                        {emotion === 'submitting' && 'Verifying…'}
                                        {emotion === 'success' && 'Access granted'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── CARD ── */}
                    <div
                        className="bg-white rounded-3xl overflow-hidden"
                        style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)' }}
                    >
                        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right, #6366F1, #8B5CF6, #A78BFA)' }} />
                        <div className="px-5 pt-6 pb-5 md:px-8 md:pt-8 md:pb-8">

                            {/* Heading */}
                            <div className="mb-5 md:mb-6">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={isSignUp ? 'sup' : 'sig'}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                                    >
                                        <h1 className="text-[26px] font-black text-slate-900 tracking-[-0.02em] leading-tight">
                                            {isSignUp ? 'Create your account' : 'Welcome back'}
                                        </h1>
                                        {/* ── CHANGE 9: Tagline woven into sign-in subtitle ── */}
                                        <p className="mt-1.5 text-slate-400 text-[13px] font-medium leading-relaxed">
                                            {isSignUp
                                                ? 'Set up your NirogOS workspace in seconds.'
                                                : 'Sign in to manage your NirogOS clinic dashboard.'}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Error banner */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        className="mb-4 flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    >
                                        <span className="text-base leading-none mt-0.5">⚠️</span>
                                        <span className="font-medium text-[13px]">{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Form */}
                            <form onSubmit={handleAuth} className="space-y-3">

                                {/* Sign-up name fields */}
                                <AnimatePresence>
                                    {isSignUp && (
                                        <motion.div
                                            className="grid grid-cols-2 gap-3"
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                                        >
                                            <FormInput
                                                icon={<User size={16} />}
                                                type="text" placeholder="First name" value={firstName} required={isSignUp}
                                                onChange={setFirstName} onFocus={() => onFocus('name')} onBlur={onBlur}
                                            />
                                            <FormInput
                                                icon={<User size={16} />}
                                                type="text" placeholder="Last name" value={lastName}
                                                onChange={setLastName} onFocus={() => onFocus('name')} onBlur={onBlur}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <FormInput
                                    icon={<Mail size={16} />}
                                    type="email" placeholder="Email address" value={email} required
                                    onChange={v => { setEmail(v); resetIdle(); }}
                                    onFocus={() => onFocus('email')} onBlur={onBlur}
                                    isValid={focusedField === 'email' && emailValid}
                                />

                                <FormInput
                                    icon={<Lock size={16} />}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password" value={password} required
                                    onChange={v => { setPassword(v); resetIdle(); }}
                                    onFocus={() => onFocus('password')} onBlur={onBlur}
                                    rightSlot={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(p => !p)}
                                            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                            tabIndex={-1}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    }
                                />

                                {/* Forgot password */}
                                {!isSignUp && (
                                    <div className="flex justify-end -mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPassword(true)}
                                            className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 transition-colors"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                {/* ── Sign-up legal checkboxes (existing, rebranded) ── */}
                                <AnimatePresence>
                                    {isSignUp && (
                                        <motion.div
                                            className="space-y-2 pt-1"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="h-px flex-1 bg-slate-200" />
                                                <span className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase">
                                                    Required agreements
                                                </span>
                                                <div className="h-px flex-1 bg-slate-200" />
                                            </div>

                                            {/* ── CHANGE 10: "NirogOS" in all sign-up checkbox copy ── */}
                                            <LegalCheckbox id="accept-terms" checked={acceptedTerms} onChange={setAcceptedTerms} required>
                                                I agree to the{' '}
                                                <Link to="/terms" target="_blank" className="text-indigo-600 font-bold hover:underline" onClick={e => e.stopPropagation()}>
                                                    Terms of Service
                                                </Link>{' '}
                                                and confirm I am authorised to use this platform on behalf of my practice.
                                            </LegalCheckbox>

                                            <LegalCheckbox id="accept-privacy" checked={acceptedPrivacy} onChange={setAcceptedPrivacy} required>
                                                I have read and accept the{' '}
                                                <Link to="/privacy" target="_blank" className="text-indigo-600 font-bold hover:underline" onClick={e => e.stopPropagation()}>
                                                    Privacy Policy
                                                </Link>
                                                , including how patient and practice data is collected, stored, and processed.
                                            </LegalCheckbox>

                                            {/* ── CHANGE 11: "NirogOS" → "NirogOS" inside HIPAA BAA text ── */}
                                            <LegalCheckbox id="accept-hipaa" checked={acceptedHipaa} onChange={setAcceptedHipaa} required>
                                                I acknowledge the{' '}
                                                <Link to="/hipaa-baa" target="_blank" className="text-indigo-600 font-bold hover:underline" onClick={e => e.stopPropagation()}>
                                                    HIPAA Business Associate Agreement (BAA)
                                                </Link>{' '}
                                                and understand NirogOS acts as a Business Associate under HIPAA.
                                            </LegalCheckbox>

                                            <LegalCheckbox id="accept-age" checked={acceptedAge} onChange={setAcceptedAge} required>
                                                I confirm I am at least 18 years old and a licensed healthcare professional or authorised administrator.
                                            </LegalCheckbox>

                                            {/* Consent progress bar */}
                                            <div className="pt-1">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">
                                                        Consent progress
                                                    </span>
                                                    <span className="text-[10px] font-bold text-indigo-500">
                                                        {[acceptedTerms, acceptedPrivacy, acceptedHipaa, acceptedAge].filter(Boolean).length} / 4
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full rounded-full"
                                                        style={{ background: 'linear-gradient(to right,#6366F1,#8B5CF6)' }}
                                                        animate={{
                                                            width: `${([acceptedTerms, acceptedPrivacy, acceptedHipaa, acceptedAge].filter(Boolean).length / 4) * 100}%`,
                                                        }}
                                                        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/*
                                 * ─────────────────────────────────────────────────────────
                                 * CHANGE 12: NEW — Sign-in legal checkbox (DPDP-compliant)
                                 * Shown only on the sign-in view, right above the CTA button.
                                 * Button stays disabled until this is checked.
                                 * ─────────────────────────────────────────────────────────
                                 */}
                                <AnimatePresence>
                                    {!isSignUp && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.25 }}
                                        >
                                            <LegalCheckbox
                                                id="accept-login-terms"
                                                checked={acceptedLoginTerms}
                                                onChange={setAcceptedLoginTerms}
                                                required
                                            >
                                                I agree to the NirogOS{' '}
                                                <Link
                                                    to="/terms"
                                                    target="_blank"
                                                    className="text-indigo-600 font-bold hover:underline"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    Terms of Service
                                                </Link>{' '}
                                                and{' '}
                                                <Link
                                                    to="/privacy"
                                                    target="_blank"
                                                    className="text-indigo-600 font-bold hover:underline"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    Privacy Policy
                                                </Link>
                                                .
                                            </LegalCheckbox>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Submit button */}
                                <motion.button
                                    type="submit"
                                    disabled={submitDisabled}
                                    whileTap={{ scale: 0.975 }}
                                    whileHover={
                                        !submitDisabled
                                            ? { scale: 1.008, boxShadow: '0 8px 28px rgba(99,102,241,0.32)' }
                                            : {}
                                    }
                                    className="w-full text-white py-[15px] rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2.5 mt-1 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                    style={{ background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)' }}
                                >
                                    {loading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : emotion === 'success' ? (
                                        <>✓ Done</>
                                    ) : (
                                        <>
                                            {isSignUp ? 'Create account' : 'Sign in'}
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </motion.button>

                                {/*
                                 * ─────────────────────────────────────────────────────────
                                 * CHANGE 13: NEW — Trust badge (padlock + encryption copy)
                                 * ─────────────────────────────────────────────────────────
                                 */}
                                <div className="flex items-center justify-center gap-1.5 pt-1">
                                    <ShieldCheck size={12} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-500 font-medium">
                                        256-bit Encrypted &amp; Secure • Built for Indian Healthcare
                                    </span>
                                </div>
                            </form>

                            {/* Toggle sign-in / sign-up */}
                            <div className="mt-5 text-center">
                                <span className="text-slate-400 text-[13px]">
                                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                                </span>{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(p => !p);
                                        setError(null);
                                        setEmotion('idle');
                                        setAcceptedLoginTerms(false);
                                    }}
                                    className="text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    {isSignUp ? 'Sign in' : 'Create one'}
                                </button>
                            </div>

                            {/*
                             * ─────────────────────────────────────────────────────────
                             * CHANGE 14: NEW — Footer links row
                             * Subtle, at the bottom of the card per spec.
                             * ─────────────────────────────────────────────────────────
                             */}
                            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-4">
                                <Link
                                    to="/refund-policy"
                                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Refund Policy
                                </Link>
                                <span className="text-slate-200 text-xs">|</span>
                                <Link
                                    to="/support"
                                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Contact Support
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ── FORGOT PASSWORD MODAL ── */}
            <AnimatePresence>
                {showForgotPassword && (
                    <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default LoginPage;