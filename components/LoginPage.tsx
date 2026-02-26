import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../services/db';
import { Mail, Lock, Loader2, ArrowRight, User, Pill } from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Emotion = 'idle' | 'happy' | 'sad' | 'password' | 'submitting' | 'success';

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
function useMousePosition() {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const h = (e: MouseEvent | TouchEvent) => {
            const p = 'touches' in e ? e.touches[0] : e;
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

function usePupilOffset(
    mouse: { x: number; y: number },
    eyeRef: React.RefObject<SVGCircleElement | null>,
    maxOffset: number,
    blind: boolean
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
    }, [mouse.x, mouse.y, blind]);
    return { sx, sy };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
interface EyeProps {
    cx: number; cy: number; r: number;
    mouse: { x: number; y: number };
    emotion: Emotion;
    sclera?: string;
    pupil?: string;
}

const AbstractEye: React.FC<EyeProps> = ({ cx, cy, r, mouse, emotion, sclera = 'white', pupil = '#1e1b4b' }) => {
    const ref = useRef<SVGCircleElement>(null);
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
                <motion.ellipse cx={cx} cy={cy} rx={r} ry={r * 0.08}
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
            {isBlind && (
                <motion.rect
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
            {isSad && (
                <g stroke={pupil} strokeWidth="2" strokeLinecap="round">
                    <line x1={cx - r * .5} y1={cy - r * .5} x2={cx + r * .5} y2={cy + r * .5} />
                    <line x1={cx + r * .5} y1={cy - r * .5} x2={cx - r * .5} y2={cy + r * .5} />
                </g>
            )}
            {!isBlind && !isSad && (
                <>
                    <motion.circle r={pr} fill={pupil} style={{ x: px, y: py } as any} />
                    <motion.circle r={pr * .3} fill="rgba(255,255,255,0.9)" style={{ x: shineX, y: shineY } as any} />
                </>
            )}
        </g>
    );
};

interface MouthProps { cx: number; cy: number; w: number; emotion: Emotion; color: string; }
const AbstractMouth: React.FC<MouthProps> = ({ cx, cy, w, emotion, color }) => {
    const h = w * 0.35;
    const d = emotion === 'sad'
        ? `M${cx - w} ${cy + h} Q${cx} ${cy - h * .5} ${cx + w} ${cy + h}`
        : emotion === 'password'
            ? `M${cx - w * .7} ${cy} L${cx + w * .7} ${cy}`
            : `M${cx - w} ${cy} Q${cx} ${cy + h * 1.2} ${cx + w} ${cy}`;
    return (
        <AnimatePresence mode="wait">
            <motion.path key={d} d={d}
                stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0 }}
                transition={{ duration: 0.28 }}
            />
        </AnimatePresence>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTERS
// ─────────────────────────────────────────────────────────────────────────────
const CharPurple: React.FC<{ mouse: { x: number; y: number }; emotion: Emotion }> = ({ mouse, emotion }) => {
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
                        transition={{ duration: 0.55, times: [0, .25, .5, .75, 1] }}
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

const CharOrange: React.FC<{ mouse: { x: number; y: number }; emotion: Emotion }> = ({ mouse, emotion }) => (
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

const CharDark: React.FC<{ mouse: { x: number; y: number }; emotion: Emotion }> = ({ mouse, emotion }) => (
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

const CharYellow: React.FC<{ mouse: { x: number; y: number }; emotion: Emotion }> = ({ mouse, emotion }) => (
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
const Breathing: React.FC<{ delay?: number; range?: number; duration?: number; children: React.ReactNode; className?: string }> =
    ({ delay = 0, range = 3, duration = 3.5, children, className }) => (
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
const CharacterStage: React.FC<{ emotion: Emotion; compact?: boolean }> = ({ emotion, compact = false }) => {
    const mouse = useMousePosition();
    const scale = compact ? 0.46 : 1;

    return (
        <div className="relative flex flex-col items-center w-full" style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}>
            <AnimatePresence>
                {(emotion === 'password' || emotion === 'sad' || emotion === 'success') && (
                    <motion.div
                        className="absolute -top-8 inset-x-0 flex justify-center z-20"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    >
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border backdrop-blur-sm ${emotion === 'password' ? 'bg-slate-800/80 text-slate-200 border-slate-600'
                            : emotion === 'sad' ? 'bg-red-950/80 text-red-300 border-red-800'
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
                <div className="w-4/5 h-4/5 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 72%)' }} />
            </div>

            <div className="flex items-end justify-center gap-3 sm:gap-5 relative pt-6">
                <motion.div
                    initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}>
                    <Breathing delay={0} range={3} duration={3.8}>
                        <svg viewBox="0 0 80 160" className="w-[78px] h-[156px] sm:w-24 sm:h-48 md:w-[118px] md:h-[236px] overflow-visible drop-shadow-lg">
                            <CharPurple mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>

                <motion.div
                    initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.22 }}>
                    <Breathing delay={0.9} range={2.5} duration={4.1}>
                        <svg viewBox="0 0 76 118" className="w-[68px] h-[108px] sm:w-[80px] sm:h-[124px] md:w-24 md:h-[148px] overflow-visible drop-shadow-lg">
                            <CharOrange mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>

                <motion.div
                    initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 }}>
                    <Breathing delay={1.6} range={3.5} duration={3.4}>
                        <svg viewBox="0 0 60 134" className="w-[50px] h-[112px] sm:w-[60px] sm:h-[134px] md:w-[68px] md:h-[154px] overflow-visible drop-shadow-lg">
                            <CharDark mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>

                <motion.div
                    initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.46 }}>
                    <Breathing delay={0.45} range={2} duration={4.4}>
                        <svg viewBox="0 0 76 116" className="w-[58px] h-[88px] sm:w-[68px] sm:h-[104px] md:w-[78px] md:h-[120px] overflow-visible drop-shadow-lg">
                            <CharYellow mouse={mouse} emotion={emotion} />
                        </svg>
                    </Breathing>
                </motion.div>
            </div>

            <div className="relative mt-1 w-full flex justify-center">
                <div className="h-4 w-4/5 rounded-full"
                    style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.40) 0%, transparent 70%)' }} />
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM INPUT
// ─────────────────────────────────────────────────────────────────────────────
const FormInput: React.FC<{
    icon: React.ReactNode;
    type: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    required?: boolean;
    isValid?: boolean;
}> = ({ icon, type, placeholder, value, onChange, onFocus, onBlur, required, isValid }) => (
    <div className={`group flex items-center gap-3.5 px-4 py-[16px] border rounded-2xl transition-all duration-200 ${isValid
        ? 'border-emerald-300 bg-emerald-50/40 shadow-sm shadow-emerald-100'
        : 'bg-slate-50/80 border-slate-200/80 focus-within:border-indigo-400/70 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-indigo-100/80'
        }`}>
        <span className="text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-200 flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
        <input
            style={{ fontSize: '16px' }}
            type={type} placeholder={placeholder} value={value} required={required}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
            className="flex-1 bg-transparent outline-none text-slate-800 font-medium placeholder:text-slate-400/70 placeholder:font-normal"
        />
        {isValid && (
            <motion.span className="text-emerald-500 text-sm font-bold flex-shrink-0"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}>✓</motion.span>
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOGIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export interface LoginPageProps {
    onNavigate?: (view: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emotion, setEmotion] = useState<Emotion>('idle');
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── CHECK IF ALREADY LOGGED IN ON MOUNT ──
    // ── NOTE: We don't manually navigate here. App.tsx listens to onAuthStateChange
    // and will automatically unmount LoginPage and mount the Dashboard when a session exists.
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                toast.success('Restoring session...', { position: 'bottom-center' });
            }
        });
    }, []);

    // Idle timer
    const resetIdle = useCallback(() => {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        if (focusedField === 'password') return;
        idleTimer.current = setTimeout(() => {
            setEmotion(p => (p === 'idle' ? 'idle' : p));
        }, 12000);
    }, [focusedField]);

    useEffect(() => {
        window.addEventListener('mousemove', resetIdle, { passive: true });
        resetIdle();
        return () => {
            window.removeEventListener('mousemove', resetIdle);
            if (idleTimer.current) clearTimeout(idleTimer.current);
        };
    }, [resetIdle]);

    // Emotion derived from focus + email validity
    useEffect(() => {
        if (emotion === 'success' || emotion === 'submitting') return;
        if (focusedField === 'password') { setEmotion('password'); return; }
        if (focusedField === 'email' && EMAIL_RE.test(email)) { setEmotion('happy'); return; }
        if (emotion !== 'sad') setEmotion('idle');
    }, [focusedField, email]);

    // ── FIXED handleAuth WITH REDIRECT ──
    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setEmotion('submitting');

        try {
            if (isSignUp) {
                // ── SIGN UP ──
                if (!firstName.trim()) {
                    setError('First name is required.');
                    toast.error('First name is required.');
                    setLoading(false);
                    setEmotion('sad');
                    return;
                }

                const { data, error: err } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                        data: {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
                        },
                    },
                });

                if (err) throw err;

                setEmotion('success');

                if (data.session) {
                    // Email confirmation not required
                    toast.success('Account created successfully!');
                } else {
                    // Email confirmation required
                    toast.success('Account created! Check your email to confirm, then sign in.');
                    setTimeout(() => setEmotion('idle'), 3500);
                }

            } else {
                // ── SIGN IN ──
                const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });

                if (err) throw err;

                // Backfill full_name if missing
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

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row">

            {/* ═══════════════════════ LEFT PANEL ═══════════════════════ */}
            <div
                className="hidden md:flex md:w-1/2 flex-col relative overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, #13111f 0%, #1e1b4b 35%, #1a1040 65%, #0c0f1d 100%)',
                    minHeight: '100vh'
                }}
            >
                {/* Dot-grain noise */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
                    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
                    backgroundSize: '22px 22px'
                }} />
                {/* Indigo glow */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'radial-gradient(ellipse 70% 55% at 50% 62%, rgba(99,102,241,0.18) 0%, transparent 100%)'
                }} />
                {/* Violet corner — top-right */}
                <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none" style={{
                    background: 'radial-gradient(circle at top right, rgba(139,92,246,0.14) 0%, transparent 65%)'
                }} />
                {/* Blue corner — bottom-left */}
                <div className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none" style={{
                    background: 'radial-gradient(circle at bottom left, rgba(59,130,246,0.09) 0%, transparent 70%)'
                }} />
                {/* Top vignette */}
                <div className="absolute top-0 inset-x-0 h-36 pointer-events-none" style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 100%)'
                }} />
                {/* Bottom vignette */}
                <div className="absolute bottom-0 inset-x-0 h-36 pointer-events-none" style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.32) 0%, transparent 100%)'
                }} />

                {/* Logo */}
                <div className="flex-shrink-0 px-9 pt-9 flex items-center gap-3 z-10">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 16px rgba(99,102,241,0.35)' }}>
                            <Pill className="text-white w-5 h-5" />
                        </div>
                        <div className="absolute inset-0 rounded-xl blur-md opacity-40"
                            style={{ background: 'radial-gradient(circle, #6366F1, transparent)' }} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-[15px] tracking-tight text-white leading-none">ClinicOS</span>
                        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'rgba(139,92,246,0.7)' }}>Advanced Healthtech</span>
                    </div>
                </div>

                {/* Character Stage */}
                <div className="flex-1 flex flex-col items-center justify-center w-full px-8 z-10">
                    <div className="w-full max-w-[340px]">
                        <CharacterStage emotion={emotion} />
                    </div>

                    {/* Emotion pill */}
                    <AnimatePresence mode="wait">
                        <motion.div key={emotion}
                            className="mt-7 flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.25 }}>
                            <span className="relative flex h-1.5 w-1.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${emotion === 'sad' ? 'bg-red-400' : emotion === 'success' ? 'bg-emerald-400' : emotion === 'happy' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${emotion === 'sad' ? 'bg-red-400' : emotion === 'success' ? 'bg-emerald-400' : emotion === 'happy' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
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

                {/* Brand statement */}
                <div className="flex-shrink-0 px-9 pb-10 z-10">
                    <p className="text-[13px] font-semibold leading-relaxed" style={{ color: 'rgba(255,255,255,0.18)' }}>
                        Built for doctors who care about every detail.
                    </p>
                </div>
            </div>

            {/* ═══════════════════════ RIGHT PANEL ═══════════════════════ */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center min-h-screen px-4 md:px-5 py-6 md:py-12 relative"
                style={{ background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                <motion.div
                    className="w-full max-w-[400px]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                >
                    {/* ── MOBILE TOP SECTION — Logo + Compact Mascots ── */}
                    <div className="flex md:hidden flex-col items-center mb-6">
                        {/* Logo */}
                        <div className="flex items-center gap-2.5 mb-5 self-start">
                            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <Pill className="text-white w-5 h-5" />
                            </div>
                            <span className="font-black text-xl tracking-tight text-slate-900">ClinicOS</span>
                        </div>

                        {/* Mascot strip — appears ABOVE the form card */}
                        <div
                            className="w-full rounded-2xl overflow-hidden mb-2 relative"
                            style={{
                                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
                                minHeight: '100px',
                            }}
                        >
                            {/* Dot grain overlay */}
                            <div
                                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                                style={{
                                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                                    backgroundSize: '18px 18px',
                                }}
                            />
                            {/* Radial glow */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 70%, rgba(99,102,241,0.25) 0%, transparent 100%)' }}
                            />
                            {/* Mascot characters — positioned at BOTTOM of banner so heads are visible */}
                            <div className="relative z-10 flex justify-center items-end h-[100px] pb-0">
                                <CharacterStage emotion={emotion} compact />
                            </div>

                            {/* Status pill overlay */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                                <div
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                    style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.14)',
                                        backdropFilter: 'blur(8px)',
                                    }}
                                >
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${emotion === 'sad' ? 'bg-red-400' :
                                            emotion === 'success' ? 'bg-emerald-400' :
                                                emotion === 'happy' ? 'bg-emerald-400' : 'bg-indigo-400'
                                            }`} />
                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${emotion === 'sad' ? 'bg-red-400' :
                                            emotion === 'success' ? 'bg-emerald-400' :
                                                emotion === 'happy' ? 'bg-emerald-400' : 'bg-indigo-400'
                                            }`} />
                                    </span>
                                    <span className="text-[10px] font-semibold text-white/60 tracking-wide">
                                        {emotion === 'idle' && 'Clinic is ready'}
                                        {emotion === 'happy' && 'Looking good'}
                                        {emotion === 'sad' && 'Check credentials'}
                                        {emotion === 'password' && 'Privacy mode'}
                                        {emotion === 'submitting' && 'Verifying...'}
                                        {emotion === 'success' && 'Access granted'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-3xl overflow-hidden"
                        style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                        {/* Indigo accent bar */}
                        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right, #6366F1, #8B5CF6, #A78BFA)' }} />
                        <div className="px-5 pt-6 pb-5 md:px-8 md:pt-8 md:pb-8">

                            {/* Heading */}
                            <div className="mb-5 md:mb-8">
                                <AnimatePresence mode="wait">
                                    <motion.div key={isSignUp ? 'sup' : 'sig'}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}>
                                        <h1 className="text-[28px] font-black text-slate-900 tracking-[-0.02em] leading-tight">
                                            {isSignUp ? 'Create your account' : 'Welcome back'}
                                        </h1>
                                        <p className="mt-2 text-slate-400 text-[13.5px] font-medium leading-relaxed">
                                            {isSignUp
                                                ? 'Set up your ClinicOS workspace in seconds.'
                                                : 'Sign in to manage your clinic dashboard.'}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Error banner */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm"
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                        <span className="text-lg leading-none">⚠️</span>
                                        <span className="font-medium">{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Form */}
                            <form onSubmit={handleAuth} className="space-y-3">
                                <AnimatePresence>
                                    {isSignUp && (
                                        <motion.div className="grid grid-cols-2 gap-3"
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
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
                                    type="password" placeholder="Password" value={password} required
                                    onChange={v => { setPassword(v); resetIdle(); }}
                                    onFocus={() => onFocus('password')} onBlur={onBlur}
                                />

                                {!isSignUp && (
                                    <div className="flex justify-end">
                                        <button type="button" className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 transition-colors">
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                <motion.button
                                    type="submit"
                                    disabled={loading || emotion === 'success'}
                                    whileTap={{ scale: 0.975 }}
                                    whileHover={{ scale: 1.008, boxShadow: '0 8px 28px rgba(99,102,241,0.32)' }}
                                    className="w-full text-white py-[15px] rounded-2xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2.5 disabled:opacity-55 mt-2"
                                    style={{
                                        background: emotion === 'success'
                                            ? 'linear-gradient(135deg, #10B981, #059669)'
                                            : 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                                        boxShadow: '0 4px 18px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.12)'
                                    }}
                                >
                                    {loading
                                        ? <Loader2 className="animate-spin" size={18} />
                                        : emotion === 'success'
                                            ? <><span>✓</span> You're in!</>
                                            : <>{isSignUp ? 'Create Account' : 'Continue'} <ArrowRight size={17} className="opacity-80" /></>
                                    }
                                </motion.button>
                            </form>

                            {/* Toggle sign in / sign up */}
                            <p className="mt-6 text-center text-slate-500 text-sm">
                                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                                <button
                                    onClick={() => { setIsSignUp(!isSignUp); setEmotion('idle'); setError(null); }}
                                    className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
                                >
                                    {isSignUp ? 'Sign in' : 'Sign up free'}
                                </button>
                            </p>
                        </div>
                    </div>

                </motion.div>

                {/* ── COMPACT FOOTER — collapses on mobile ── */}
                <div className="mt-4">
                    {/* Legal consent line — always visible, compact */}
                    <p className="text-center text-slate-400 text-[11px] leading-relaxed">
                        By continuing you agree to our{' '}
                        <Link
                            to="/terms"
                            className="text-indigo-500 font-semibold hover:underline"
                        >
                            Terms
                        </Link>
                        {' '}&{' '}
                        <Link
                            to="/privacy"
                            className="text-indigo-500 font-semibold hover:underline"
                        >
                            Privacy
                        </Link>
                    </p>

                    {/* Extra links — HIDDEN on mobile, shown on desktop */}
                    <div className="hidden md:flex items-center justify-center gap-4 mt-4">
                        <Link to="/privacy" className="text-slate-400 text-xs hover:text-slate-600 transition">Privacy Policy</Link>
                        <span className="text-slate-200">·</span>
                        <Link to="/terms" className="text-slate-400 text-xs hover:text-slate-600 transition">Terms of Service</Link>
                        <span className="text-slate-200">·</span>
                        <a href="mailto:support@clinicos.com" className="text-slate-400 text-xs hover:text-slate-600 transition">Contact Support</a>
                    </div>

                    {/* Copyright — hidden on mobile */}
                    <p className="hidden md:block text-center text-slate-300 text-[11px] mt-3">
                        © 2026 ClinicOS. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;