import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/db'
import { Search, Plus, Pill, X } from 'lucide-react'

// Passing clinicId as prop since useAuth wasn't present in the project auth context
interface Medicine {
    id: string
    name: string
    generic_name: string | null
    strength: string | null
    form: string | null
    category: string | null
    is_custom: boolean
}

interface PrescriptionLine {
    medicine_id: string | null
    medicine_name: string
    strength: string
    form: string
    dosage: string       // e.g. '1-0-1'
    duration: string     // e.g. '5 days'
    instructions: string // e.g. 'After food'
}

interface MedicineSearchProps {
    clinicId: string
    onAdd: (line: PrescriptionLine) => void
}

const DOSAGE_PRESETS = [
    '1-0-0 (Morning only)',
    '0-0-1 (Night only)',
    '1-0-1 (Morning & Night)',
    '1-1-1 (Three times daily)',
    'As needed (SOS)',
    'Once weekly',
]

const DURATION_PRESETS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months']

export function MedicineSearch({ clinicId, onAdd }: MedicineSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Medicine[]>([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Medicine | null>(null)
    const [showDropdown, setShowDropdown] = useState(false)
    const [line, setLine] = useState<Partial<PrescriptionLine>>({
        dosage: '',
        duration: '5 days',
        instructions: 'After food',
    })
    const inputRef = useRef<HTMLInputElement>(null)

    // Search medicines as user types
    useEffect(() => {
        if (query.length < 2) { setResults([]); return }

        const timeout = setTimeout(async () => {
            setLoading(true)
            const { data } = await supabase
                .from('medicines')
                .select('id, name, generic_name, strength, form, category, is_custom')
                .ilike('name', `%${query}%`)
                .order('usage_count', { ascending: false })
                .limit(8)

            setResults(data ?? [])
            setShowDropdown(true)
            setLoading(false)
        }, 220)

        return () => clearTimeout(timeout)
    }, [query])

    async function selectMedicine(med: Medicine) {
        setSelected(med)
        setQuery(med.name)
        setShowDropdown(false)
        setLine(prev => ({
            ...prev,
            medicine_id: med.id,
            medicine_name: med.name,
            strength: med.strength ?? '',
            form: med.form ?? '',
        }))
    }

    // If user types something not found, treat as new custom medicine
    async function saveCustomMedicine(name: string): Promise<Medicine> {
        const { data, error } = await supabase
            .from('medicines')
            .insert({
                name: name.trim(),
                is_custom: true,
                created_by_clinic_id: clinicId,
                usage_count: 1,
            })
            .select()
            .single()

        if (error) throw error
        return data
    }

    async function handleAdd() {
        if (!query.trim()) return
        if (!line.dosage?.trim()) { alert('Please enter dosage (e.g. 1-0-1)'); return }

        let finalMedicine = selected

        // If no existing medicine was selected from dropdown, create a new one
        if (!selected) {
            try {
                finalMedicine = await saveCustomMedicine(query)
            } catch (e: any) {
                // Medicine might already exist — try to find it
                console.error('Save custom medicine threw, perhaps duplicate?', e);
                const { data } = await supabase
                    .from('medicines')
                    .select('*')
                    .ilike('name', query.trim())
                    .single()
                finalMedicine = data
            }
        } else {
            // Increment usage count for existing medicine
            await supabase
                .from('medicines')
                .update({ usage_count: (selected as any).usage_count + 1 })
                .eq('id', selected.id)
        }

        onAdd({
            medicine_id: finalMedicine?.id ?? null,
            medicine_name: query.trim(),
            strength: (line.strength ?? finalMedicine?.strength) ?? '',
            form: (line.form ?? finalMedicine?.form) ?? '',
            dosage: line.dosage ?? '',
            duration: line.duration ?? '5 days',
            instructions: line.instructions ?? '',
        })

        // Reset
        setQuery('')
        setSelected(null)
        setLine({ dosage: '', duration: '5 days', instructions: 'After food' })
        inputRef.current?.focus()
    }

    return (
        <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
                <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                    <Search size={15} className="text-slate-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        style={{ fontSize: '16px' }}
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        placeholder="Search medicine or type new name..."
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelected(null) }}
                        onFocus={() => query.length >= 2 && setShowDropdown(true)}
                    />
                    {query && (
                        <button onClick={() => { setQuery(''); setSelected(null); setResults([]) }}>
                            <X size={14} className="text-slate-400" />
                        </button>
                    )}
                </div>

                {/* Dropdown results */}
                {showDropdown && (results.length > 0 || loading) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                        {loading && (
                            <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
                        )}
                        {results.map(med => (
                            <button
                                key={med.id}
                                onClick={() => selectMedicine(med)}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{med.name}</p>
                                        {med.generic_name && (
                                            <p className="text-slate-400 text-xs">{med.generic_name}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
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
                                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                Custom
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                        {/* Add as new medicine option */}
                        {!loading && query.length >= 2 && (
                            <button
                                onClick={() => { setShowDropdown(false) }}
                                className="w-full text-left px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-2"
                            >
                                <Plus size={14} className="text-indigo-600" />
                                <span className="text-indigo-700 text-sm font-semibold">
                                    Add "{query}" as a new medicine
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Strength & Form (if medicine selected or custom entry) */}
            {query.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-200">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Strength</label>
                            <input
                                style={{ fontSize: '16px' }}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-400"
                                placeholder="e.g. 500mg"
                                value={line.strength ?? ''}
                                onChange={e => setLine(l => ({ ...l, strength: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Form</label>
                            <select
                                style={{ fontSize: '16px' }}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 appearance-none"
                                value={line.form ?? ''}
                                onChange={e => setLine(l => ({ ...l, form: e.target.value }))}
                            >
                                <option value="">Select</option>
                                {['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'inhaler', 'sachet', 'gel'].map(f => (
                                    <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dosage */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Dosage *</label>
                        <input
                            style={{ fontSize: '16px' }}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-indigo-400 mb-1.5"
                            placeholder="e.g. 1-0-1 or Twice daily"
                            value={line.dosage ?? ''}
                            onChange={e => setLine(l => ({ ...l, dosage: e.target.value }))}
                        />
                        {/* Quick dosage presets */}
                        <div className="flex flex-wrap gap-1.5">
                            {['1-0-0', '0-0-1', '1-0-1', '1-1-1', 'SOS'].map(d => (
                                <button key={d} onClick={() => setLine(l => ({ ...l, dosage: d }))}
                                    className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition ${line.dosage === d
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                        }`}>
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Duration *</label>
                        <div className="flex flex-wrap gap-1.5">
                            {DURATION_PRESETS.map(d => (
                                <button key={d} onClick={() => setLine(l => ({ ...l, duration: d }))}
                                    className={`text-xs px-2.5 py-1.5 rounded-full border font-semibold transition ${line.duration === d
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                        }`}>
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Instructions</label>
                        <div className="flex flex-wrap gap-1.5">
                            {['After food', 'Before food', 'With water', 'Before sleep', 'Empty stomach'].map(i => (
                                <button key={i} onClick={() => setLine(l => ({ ...l, instructions: i }))}
                                    className={`text-xs px-2.5 py-1.5 rounded-full border font-semibold transition ${line.instructions === i
                                            ? 'bg-slate-800 text-white border-slate-800'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                        }`}>
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Add button */}
                    <button
                        onClick={handleAdd}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 active:bg-indigo-800 transition"
                    >
                        <Plus size={16} />
                        Add to Prescription
                    </button>
                </div>
            )}
        </div>
    )
}
