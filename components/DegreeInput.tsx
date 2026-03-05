import { useState, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

const DEGREE_SUGGESTIONS = [
    'MBBS', 'MD', 'MS', 'BDS', 'MDS', 'BAMS', 'BHMS', 'DNB',
    'DM', 'MCh', 'FRCS', 'MRCP', 'PhD', 'FCPS', 'MSOE', 'DNB (Radiology)'
]

interface DegreeInputProps {
    values: string[]
    onChange: (v: string[]) => void
    placeholder?: string
    error?: string
}

export function DegreeInput({ values, onChange, placeholder = 'Type degree and press Enter…', error }: DegreeInputProps) {
    const [input, setInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const filtered = input.length >= 1
        ? DEGREE_SUGGESTIONS.filter(d =>
            d.toLowerCase().startsWith(input.toLowerCase()) && !values.includes(d)
        ).slice(0, 6)
        : []

    function addDegree(degree: string) {
        const clean = degree.trim().toUpperCase()
        if (!clean || values.includes(clean)) return
        onChange([...values, clean])
        setInput('')
        setShowSuggestions(false)
        inputRef.current?.focus()
    }

    function removeDegree(idx: number) {
        onChange(values.filter((_, i) => i !== idx))
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            if (input.trim()) addDegree(input)
        }
        if (e.key === 'Backspace' && !input && values.length > 0) {
            removeDegree(values.length - 1)
        }
        if (e.key === 'Escape') setShowSuggestions(false)
    }

    return (
        <div className="relative">
            {/* Chip container + input */}
            <div
                onClick={() => inputRef.current?.focus()}
                className={`
          flex flex-wrap gap-1.5 px-3 py-2.5 min-h-[48px] bg-white border rounded-xl cursor-text transition
          ${error ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100'}
        `}
            >
                {values.map((deg, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold select-none"
                    >
                        {deg}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeDegree(i) }}
                            className="text-indigo-400 hover:text-indigo-700 transition-colors"
                        >
                            <X size={10} strokeWidth={3} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={values.length === 0 ? placeholder : ''}
                    style={{ fontSize: 16 }}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-slate-800 font-medium placeholder:text-slate-400 placeholder:text-sm"
                />
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {filtered.map(deg => (
                        <button
                            key={deg}
                            type="button"
                            onMouseDown={() => addDegree(deg)}
                            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                            {deg}
                        </button>
                    ))}
                </div>
            )}

            <p className="text-xs text-slate-400 mt-1.5 font-medium">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold">Enter</kbd>{' '}
                or <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold">,</kbd> to add each degree
            </p>

            {error && (
                <p className="text-xs font-semibold text-rose-500 mt-1">{error}</p>
            )}
        </div>
    )
}
