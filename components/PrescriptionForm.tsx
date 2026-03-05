import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Plus, X, Pill,
    ChevronDown, Trash2, Pencil
} from 'lucide-react'
import { supabase } from '../services/db'
import { MEDICINE_DB } from '../lib/medicine-database'
import toast from 'react-hot-toast'

// ── Types ──────────────────────────────────────────────────────────
export interface PrescriptionLine {
    id: string
    medicine_id: string | null
    medicine_name: string
    generic_name: string | null
    strength: string
    form: string
    timing: [number, number, number]
    food_relation: 'after' | 'before' | 'with' | 'any'
    duration_value: number
    duration_unit: 'days' | 'weeks' | 'months'
    instructions: string
}

interface Medicine {
    id: string
    name: string
    generic_name: string | null
    strength: string | null
    form: string | null
    usage_count: number
    is_custom: boolean
}

interface PrescriptionFormProps {
    clinicId: string
    lines: PrescriptionLine[]
    onChange: (lines: PrescriptionLine[]) => void
}

// ── Constants ──────────────────────────────────────────────────────
const FORM_TYPES = [
    'Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream',
    'Inhaler', 'Sachet', 'Gel', 'Powder', 'Ointment', 'Spray',
    'Patch', 'Suppository',
]

const FOOD_OPTIONS: { value: PrescriptionLine['food_relation']; label: string; color: string; dotColor: string }[] = [
    { value: 'before', label: 'Before', color: 'bg-red-600 text-white border-red-600', dotColor: '🔴' },
    { value: 'after', label: 'After', color: 'bg-green-600 text-white border-green-600', dotColor: '🟢' },
    { value: 'with', label: 'With', color: 'bg-amber-500 text-white border-amber-500', dotColor: '🟡' },
    { value: 'any', label: 'Any', color: 'bg-slate-500 text-white border-slate-500', dotColor: '⚫' },
]

function newLine(med?: Partial<PrescriptionLine>): PrescriptionLine {
    return {
        id: crypto.randomUUID(),
        medicine_id: null,
        medicine_name: '',
        generic_name: null,
        strength: '',
        form: 'Tablet',
        timing: [1, 0, 1],
        food_relation: 'after',
        duration_value: 5,
        duration_unit: 'days',
        instructions: '',
        ...med,
    }
}

// ── Timing preview line ────────────────────────────────────────────
function timingPreview(m: number, a: number, n: number): string {
    const pattern = `${m}-${a}-${n}`
    const parts: string[] = []
    if (m > 0) parts.push(m === 2 ? '2× Morning' : 'Morning')
    if (a > 0) parts.push(a === 2 ? '2× Afternoon' : 'Afternoon')
    if (n > 0) parts.push(n === 2 ? '2× Night' : 'Night')
    if (parts.length === 0) return 'SOS / As needed'
    return `${pattern} · ${parts.join(' & ')}`
}

// ── Collapsed line summary ─────────────────────────────────────────
function collapsedSummary(line: PrescriptionLine): string {
    const food = FOOD_OPTIONS.find(f => f.value === line.food_relation)
    const timing = line.timing.join('-')
    const dur = `${line.duration_value}${line.duration_unit === 'days' ? 'D' : line.duration_unit === 'weeks' ? 'W' : 'M'}`
    return `${timing}  ${food?.dotColor ?? ''} ${food?.label ?? ''} food  ${dur}`
}

// ── Form abbreviation ──────────────────────────────────────────────
function formAbbrev(form: string): string {
    const map: Record<string, string> = {
        Tablet: 'Tab.', Capsule: 'Cap.', Syrup: 'Syr.',
        Injection: 'Inj.', Drops: 'Drops', Cream: 'Cream',
        Inhaler: 'Inh.', Sachet: 'Sachet', Gel: 'Gel',
        Powder: 'Powd.', Ointment: 'Oint.', Spray: 'Spray',
        Patch: 'Patch', Suppository: 'Supp.',
    }
    return map[form] ?? form
}

// ── Medicine Search Input ──────────────────────────────────────────
function MedicineSearchInput({
    clinicId,
    onSelect,
}: {
    clinicId: string
    onSelect: (med: Medicine | null, rawName: string) => void
}) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Medicine[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        if (query.length < 2) { setResults([]); setOpen(false); return }

        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(async () => {
            setLoading(true)

            // 1. Try Supabase clinic history first
            const { data: dbResults } = await supabase
                .from('medicines')
                .select('id, name, generic_name, strength, form, usage_count, is_custom')
                .ilike('name', `%${query}%`)
                .order('usage_count', { ascending: false })
                .limit(6)

            // 2. Also search local medicine DB
            const localResults = MEDICINE_DB
                .filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 4)
                .map((m, i) => ({
                    id: `local-${i}`,
                    name: m.name,
                    generic_name: null,
                    strength: m.defaultStrength,
                    form: m.form.charAt(0).toUpperCase() + m.form.slice(1),
                    usage_count: 0,
                    is_custom: false,
                }))

            const combined: Medicine[] = [
                ...(dbResults ?? []),
                ...localResults.filter(l => !(dbResults ?? []).some(d => d.name.toLowerCase() === l.name.toLowerCase())),
            ].slice(0, 8)

            setResults(combined)
            setOpen(true)
            setLoading(false)
        }, 200)

        return () => clearTimeout(timeoutRef.current)
    }, [query])

    async function handleAutoAdd() {
        if (!query.trim() || query.length < 2) return

        const parts = query.trim().split(/\s+/)
        const name = parts[0]
        const strengthMatch = parts.find(p => /^\d+(\.\d+)?(mg|ml|mcg|g|IU|%)$/i.test(p))
        const formMatch = parts.find(p => FORM_TYPES.map(f => f.toLowerCase()).includes(p.toLowerCase()))

        const t = toast.loading(`Adding "${query}" to medicines...`)

        const { data: newMed, error } = await supabase
            .from('medicines')
            .insert({
                name: name,
                generic_name: null,
                strength: strengthMatch ?? null,
                form: formMatch ?? null,
                is_custom: true,
                created_by_clinic_id: clinicId,
                usage_count: 1,
            })
            .select()
            .single()

        toast.dismiss(t)

        if (error) {
            const { data: existing } = await supabase
                .from('medicines')
                .select('*')
                .ilike('name', name)
                .single()

            if (existing) {
                toast.success('Found existing medicine')
                onSelect(existing, query)
            } else {
                toast.error('Could not add medicine: ' + error.message)
            }
        } else if (newMed) {
            toast.success(`"${name}" added to your clinic's medicine list`)
            onSelect(newMed, query)
        }

        setQuery('')
        setOpen(false)
    }

    return (
        <div className="relative">
            <div className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-2xl transition-all ${open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}>
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                    ref={inputRef}
                    style={{ fontSize: '16px' }}
                    className="flex-1 bg-transparent outline-none text-slate-800 font-medium placeholder:text-slate-400 placeholder:text-sm"
                    placeholder='Search "Paracetamol 500mg" + Enter to add'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            if (results.length > 0) {
                                onSelect(results[0], query)
                                setQuery('')
                                setOpen(false)
                            } else if (query.length >= 2) {
                                handleAutoAdd()
                            }
                        }
                        if (e.key === 'Escape') { setQuery(''); setOpen(false) }
                    }}
                    onFocus={() => results.length > 0 && setOpen(true)}
                />
                {loading && <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                {query && (
                    <button onClick={() => { setQuery(''); setOpen(false) }}>
                        <X size={13} className="text-slate-400" />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                    >
                        {results.map((med, i) => (
                            <button
                                key={`${med.id}-${i}`}
                                onClick={() => { onSelect(med, query); setQuery(''); setOpen(false) }}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition flex items-center justify-between border-b border-slate-50 last:border-0"
                            >
                                <div>
                                    <span className="font-semibold text-slate-900 text-sm">{med.name}</span>
                                    {med.generic_name && (
                                        <span className="text-slate-400 text-xs ml-2">{med.generic_name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {med.strength && (
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {med.strength}
                                        </span>
                                    )}
                                    {med.form && (
                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full capitalize">
                                            {med.form}
                                        </span>
                                    )}
                                    {med.is_custom && (
                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                            Custom
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}

                        <button
                            onClick={handleAutoAdd}
                            className="w-full text-left px-4 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 transition flex items-center gap-2.5"
                        >
                            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Plus size={13} className="text-white" />
                            </div>
                            <div>
                                <p className="text-indigo-700 text-sm font-bold">Add "{query}" as new medicine</p>
                                <p className="text-indigo-400 text-[11px]">Press Enter to auto-add and select</p>
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── M/A/N Timing Stepper ───────────────────────────────────────────
function TimingStepper({
    timing,
    onChange,
}: {
    timing: [number, number, number]
    onChange: (t: [number, number, number]) => void
}) {
    const slots = [
        { label: 'M', sublabel: 'Morning', index: 0 },
        { label: 'A', sublabel: 'Afternoon', index: 1 },
        { label: 'N', sublabel: 'Night', index: 2 },
    ]

    function cycle(idx: number) {
        const next: [number, number, number] = [...timing] as [number, number, number]
        next[idx] = (next[idx] + 1) % 3  // cycles 0 → 1 → 2 → 0
        onChange(next)
    }

    return (
        <div className="space-y-2">
            {/* Three stepper buttons side by side */}
            <div className="flex gap-2">
                {slots.map(slot => {
                    const val = timing[slot.index]
                    const isActive = val > 0
                    return (
                        <button
                            key={slot.label}
                            type="button"
                            onClick={() => cycle(slot.index)}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border font-bold text-sm transition min-h-[56px] active:scale-95 ${isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                        >
                            <span className="text-lg leading-none font-black">{val}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">{slot.label}</span>
                        </button>
                    )
                })}
            </div>
            {/* Live preview */}
            <p className="text-xs text-slate-500 font-medium px-1">
                {timingPreview(timing[0], timing[1], timing[2])}
            </p>
        </div>
    )
}

// ── Single Prescription Line Card ─────────────────────────────────
function PrescriptionLineCard({
    line,
    index,
    isExpanded,
    onExpand,
    onUpdate,
    onRemove,
    onSave,
}: {
    line: PrescriptionLine
    index: number
    isExpanded: boolean
    onExpand: () => void
    onUpdate: (updates: Partial<PrescriptionLine>) => void
    onRemove: () => void
    onSave: () => void
}) {
    const nameInputRef = useRef<HTMLInputElement>(null)

    // Auto-focus medicine name when expanded
    useEffect(() => {
        if (isExpanded) {
            setTimeout(() => nameInputRef.current?.focus(), 100)
        }
    }, [isExpanded])

    // Escape key collapses the card
    useEffect(() => {
        if (!isExpanded) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onSave()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isExpanded, onSave])

    const food = FOOD_OPTIONS.find(f => f.value === line.food_relation)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
            {/* ── COLLAPSED STATE ── */}
            {!isExpanded && (
                <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition"
                    onClick={onExpand}
                >
                    {/* Number + icon */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-[11px] font-black">{index + 1}</span>
                        </div>
                        <span className="text-base">💊</span>
                    </div>

                    {/* Medicine info */}
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">
                            {formAbbrev(line.form)} {line.medicine_name || 'Medicine'}
                            {line.strength && <span className="text-slate-400 font-normal ml-1">{line.strength}</span>}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5 truncate">
                            {collapsedSummary(line)}
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onExpand() }}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
                        >
                            <Pencil size={12} className="text-slate-500" />
                        </button>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onRemove() }}
                            className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition"
                        >
                            <Trash2 size={12} className="text-red-500" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── EXPANDED STATE ── */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-4 space-y-4">

                            {/* Row 1 (mobile: full width name) + Row 2 strength + form */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Medicine Name *
                                </label>
                                <input
                                    ref={nameInputRef}
                                    style={{ fontSize: '16px' }}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 mb-3"
                                    placeholder="Paracetamol"
                                    value={line.medicine_name}
                                    onChange={e => onUpdate({ medicine_name: e.target.value })}
                                />

                                <div className="grid grid-cols-5 gap-2">
                                    {/* Strength — 2/5 width */}
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                                            Strength
                                        </label>
                                        <input
                                            style={{ fontSize: '16px' }}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="500mg"
                                            value={line.strength}
                                            onChange={e => onUpdate({ strength: e.target.value })}
                                        />
                                    </div>

                                    {/* Form — 3/5 width */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                                            Form
                                        </label>
                                        <div className="relative">
                                            <select
                                                style={{ fontSize: '16px' }}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 appearance-none pr-7"
                                                value={line.form}
                                                onChange={e => onUpdate({ form: e.target.value })}
                                            >
                                                {FORM_TYPES.map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Timing steppers */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">
                                    Timing (tap to cycle 0→1→2)
                                </label>
                                <TimingStepper
                                    timing={line.timing}
                                    onChange={t => onUpdate({ timing: t })}
                                />
                            </div>

                            {/* Food + Duration on same row */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">
                                    Food & Duration
                                </label>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {/* Food segmented control */}
                                    <div className="flex rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                                        {FOOD_OPTIONS.map(f => (
                                            <button
                                                key={f.value}
                                                type="button"
                                                onClick={() => onUpdate({ food_relation: f.value })}
                                                className={`px-3 py-2 text-xs font-bold transition last:rounded-r-none first:rounded-l-none ${line.food_relation === f.value
                                                    ? f.color
                                                    : 'bg-white text-slate-500 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Duration */}
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            style={{ fontSize: '16px' }}
                                            className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 text-center"
                                            min={1} max={365}
                                            value={line.duration_value}
                                            onChange={e => onUpdate({ duration_value: parseInt(e.target.value) || 1 })}
                                        />
                                        <div className="relative">
                                            <select
                                                style={{ fontSize: '16px' }}
                                                className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 appearance-none pr-6"
                                                value={line.duration_unit}
                                                onChange={e => onUpdate({ duration_unit: e.target.value as PrescriptionLine['duration_unit'] })}
                                            >
                                                <option value="days">Days</option>
                                                <option value="weeks">Weeks</option>
                                                <option value="months">Months</option>
                                            </select>
                                            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Instructions <span className="text-slate-300 font-normal normal-case">(optional)</span>
                                </label>
                                <input
                                    style={{ fontSize: '16px' }}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-400"
                                    placeholder="e.g. Avoid dairy, take with warm water..."
                                    value={line.instructions}
                                    onChange={e => onUpdate({ instructions: e.target.value })}
                                />
                            </div>

                            {/* Save / Cancel */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onSave}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 active:bg-indigo-800 transition"
                                >
                                    + Add Medicine
                                </button>
                                <button
                                    type="button"
                                    onClick={onRemove}
                                    className="px-4 py-3 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

// ── Main PrescriptionForm ─────────────────────────────────────────
export function PrescriptionForm({ clinicId, lines, onChange }: PrescriptionFormProps) {
    // Which card index is expanded (accordion: only one at a time)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const listEndRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLDivElement>(null)

    function addLine(med?: Medicine, rawName?: string) {
        // Auto-fill from local medicine DB when a local result is clicked
        let localDefaults: Partial<PrescriptionLine> = {}
        if (rawName) {
            const localMatch = MEDICINE_DB.find(
                m => m.name.toLowerCase() === (med?.name ?? rawName).toLowerCase()
            )
            if (localMatch) {
                localDefaults = {
                    strength: localMatch.defaultStrength,
                    form: localMatch.form.charAt(0).toUpperCase() + localMatch.form.slice(1),
                    timing: localMatch.timing as [number, number, number],
                    food_relation: localMatch.food as PrescriptionLine['food_relation'],
                    duration_value: localMatch.duration,
                    duration_unit: (localMatch as { durationUnit?: string }).durationUnit as PrescriptionLine['duration_unit'] ?? 'days',
                    instructions: (localMatch as { instructions?: string }).instructions ?? '',
                }
            }
        }

        const newEntry = newLine(med ? {
            medicine_id: med.id.startsWith('local-') ? null : med.id,
            medicine_name: med.name,
            generic_name: med.generic_name,
            strength: med.strength ?? '',
            form: med.form ?? 'Tablet',
            ...localDefaults,
        } : rawName ? { medicine_name: rawName, ...localDefaults } : undefined)

        onChange([...lines, newEntry])
        // Collapse any open card and open the new one
        setExpandedId(newEntry.id)
        // Auto-scroll to show the new entry
        setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150)
    }

    function updateLine(id: string, updates: Partial<PrescriptionLine>) {
        onChange(lines.map(l => l.id === id ? { ...l, ...updates } : l))
    }

    function removeLine(id: string) {
        onChange(lines.filter(l => l.id !== id))
        if (expandedId === id) setExpandedId(null)
    }

    function handleExpand(id: string) {
        setExpandedId(prev => prev === id ? null : id)
    }

    function handleSave(id: string) {
        setExpandedId(null)
        // Validate: if medicine name is empty, remove the line
        const line = lines.find(l => l.id === id)
        if (line && !line.medicine_name.trim()) {
            onChange(lines.filter(l => l.id !== id))
        }
    }

    return (
        <div className="flex flex-col">
            {/* Sticky search bar */}
            <div ref={searchRef} className="sticky top-0 z-10 bg-white pb-3 border-b border-slate-100 mb-3">
                <MedicineSearchInput
                    clinicId={clinicId}
                    onSelect={(med, rawName) => addLine(med ?? undefined, rawName)}
                />
            </div>

            {/* Scrollable medicine list */}
            <div className="flex-1 overflow-y-auto space-y-3" style={{ maxHeight: '60vh' }}>
                <AnimatePresence>
                    {lines.map((line, i) => (
                        <PrescriptionLineCard
                            key={line.id}
                            line={line}
                            index={i}
                            isExpanded={expandedId === line.id}
                            onExpand={() => handleExpand(line.id)}
                            onUpdate={updates => updateLine(line.id, updates)}
                            onRemove={() => removeLine(line.id)}
                            onSave={() => handleSave(line.id)}
                        />
                    ))}
                </AnimatePresence>

                {/* Empty state */}
                {lines.length === 0 && (
                    <div className="text-center py-6 text-slate-300">
                        <Pill size={28} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm text-slate-400">Search above to add medicines to the prescription</p>
                        <p className="text-xs text-slate-300 mt-1">Tap a result or press Enter to add</p>
                    </div>
                )}

                {/* Auto-scroll anchor */}
                <div ref={listEndRef} />
            </div>

            {/* Summary + add more hint */}
            {lines.length > 0 && (
                <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                        <span className="text-xs font-bold text-indigo-600">
                            {lines.length} medicine{lines.length !== 1 ? 's' : ''} prescribed
                        </span>
                        <button
                            type="button"
                            onClick={() => { onChange([]); setExpandedId(null) }}
                            className="text-xs text-red-400 hover:text-red-600 font-semibold"
                        >
                            Clear all
                        </button>
                    </div>
                    {lines.length >= 3 && (
                        <button
                            type="button"
                            onClick={() => searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="w-full text-center text-xs text-indigo-500 hover:text-indigo-700 font-semibold py-2 bg-indigo-50/50 rounded-xl transition"
                        >
                            ↑ Add another medicine
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

