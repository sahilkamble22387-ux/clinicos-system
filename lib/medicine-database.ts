// lib/medicine-database.ts
// Static medicine list for autocomplete fallback (used when doctor has no history yet)
// Includes both general and dental medicines.

export interface MedicineEntry {
    name: string
    defaultStrength: string
    form: string  // matches FORM_TYPES (lowercase)
    timing: [number, number, number]  // M-A-N
    food: 'before' | 'after' | 'with' | 'any'
    duration: number
    durationUnit?: 'days' | 'weeks' | 'months'
    tags: string[]
    instructions?: string
}

export const MEDICINE_DB: MedicineEntry[] = [
    // ── General ──────────────────────────────────────────────────────
    { name: 'Paracetamol', defaultStrength: '500mg', form: 'tablet', timing: [1, 0, 1], food: 'after', duration: 5, tags: ['fever', 'pain'] },
    { name: 'Paracetamol', defaultStrength: '650mg', form: 'tablet', timing: [1, 0, 1], food: 'after', duration: 5, tags: ['fever', 'pain'] },
    { name: 'Ibuprofen', defaultStrength: '400mg', form: 'tablet', timing: [1, 1, 1], food: 'after', duration: 5, tags: ['pain', 'inflammation'] },
    { name: 'Amoxicillin', defaultStrength: '500mg', form: 'capsule', timing: [1, 0, 1], food: 'before', duration: 7, tags: ['antibiotic'] },
    { name: 'Amoxicillin + Clavulanate', defaultStrength: '625mg', form: 'tablet', timing: [1, 0, 1], food: 'after', duration: 7, tags: ['antibiotic'] },
    { name: 'Azithromycin', defaultStrength: '500mg', form: 'tablet', timing: [1, 0, 0], food: 'before', duration: 3, tags: ['antibiotic'] },
    { name: 'Metronidazole', defaultStrength: '400mg', form: 'tablet', timing: [1, 1, 1], food: 'after', duration: 5, tags: ['antibiotic', 'dental'] },
    { name: 'Cetirizine', defaultStrength: '10mg', form: 'tablet', timing: [0, 0, 1], food: 'any', duration: 5, tags: ['allergy'] },
    { name: 'Omeprazole', defaultStrength: '20mg', form: 'capsule', timing: [1, 0, 0], food: 'before', duration: 14, tags: ['acidity'] },
    { name: 'Pantoprazole', defaultStrength: '40mg', form: 'tablet', timing: [1, 0, 0], food: 'before', duration: 14, tags: ['acidity'] },
    { name: 'Domperidone', defaultStrength: '10mg', form: 'tablet', timing: [1, 0, 1], food: 'before', duration: 5, tags: ['nausea'] },
    { name: 'Ondansetron', defaultStrength: '4mg', form: 'tablet', timing: [1, 1, 1], food: 'before', duration: 3, tags: ['nausea'] },
    { name: 'Telmisartan', defaultStrength: '40mg', form: 'tablet', timing: [1, 0, 0], food: 'any', duration: 30, tags: ['bp'] },
    { name: 'Amlodipine', defaultStrength: '5mg', form: 'tablet', timing: [1, 0, 0], food: 'any', duration: 30, tags: ['bp'] },
    { name: 'Metformin', defaultStrength: '500mg', form: 'tablet', timing: [1, 0, 1], food: 'after', duration: 30, tags: ['diabetes'] },
    { name: 'Atorvastatin', defaultStrength: '10mg', form: 'tablet', timing: [0, 0, 1], food: 'any', duration: 30, tags: ['cholesterol'] },
    { name: 'Diclofenac', defaultStrength: '50mg', form: 'tablet', timing: [1, 1, 1], food: 'after', duration: 5, tags: ['pain', 'dental'] },
    { name: 'Aceclofenac', defaultStrength: '100mg', form: 'tablet', timing: [1, 0, 1], food: 'after', duration: 5, tags: ['pain', 'dental'] },
    { name: 'Serratiopeptidase', defaultStrength: '10mg', form: 'tablet', timing: [1, 0, 1], food: 'before', duration: 5, tags: ['swelling', 'dental'] },
    { name: 'Prednisolone', defaultStrength: '10mg', form: 'tablet', timing: [1, 0, 0], food: 'after', duration: 5, tags: ['inflammation', 'dental'] },
    { name: 'Vitamin C', defaultStrength: '500mg', form: 'tablet', timing: [1, 0, 0], food: 'after', duration: 30, tags: ['vitamin'] },
    { name: 'Vitamin D3', defaultStrength: '60000IU', form: 'capsule', timing: [1, 0, 0], food: 'after', duration: 8, durationUnit: 'weeks', tags: ['vitamin'] },
    { name: 'Vitamin B Complex', defaultStrength: '', form: 'tablet', timing: [1, 0, 0], food: 'after', duration: 30, tags: ['vitamin'] },
    { name: 'Zinc', defaultStrength: '20mg', form: 'tablet', timing: [1, 0, 0], food: 'after', duration: 14, tags: ['vitamin'] },
    { name: 'Iron + Folic Acid', defaultStrength: '100mg', form: 'tablet', timing: [1, 0, 0], food: 'after', duration: 30, tags: ['anaemia'] },
    { name: 'Montelukast', defaultStrength: '10mg', form: 'tablet', timing: [0, 0, 1], food: 'any', duration: 14, tags: ['asthma', 'allergy'] },
    { name: 'Salbutamol', defaultStrength: '2.5mg', form: 'inhaler', timing: [1, 1, 1], food: 'any', duration: 30, tags: ['asthma'] },
    { name: 'ORS Sachet', defaultStrength: '', form: 'sachet', timing: [1, 1, 1], food: 'any', duration: 3, tags: ['dehydration'] },
    { name: 'Loperamide', defaultStrength: '2mg', form: 'capsule', timing: [1, 0, 1], food: 'any', duration: 3, tags: ['diarrhoea'] },
    { name: 'Levothyroxine', defaultStrength: '50mcg', form: 'tablet', timing: [1, 0, 0], food: 'before', duration: 30, tags: ['thyroid'] },

    // ── Dental Specific ───────────────────────────────────────────────
    { name: 'Clindamycin', defaultStrength: '300mg', form: 'capsule', timing: [1, 1, 1], food: 'after', duration: 7, tags: ['antibiotic', 'dental'] },
    { name: 'Tinidazole', defaultStrength: '500mg', form: 'tablet', timing: [1, 0, 1], food: 'after', duration: 5, tags: ['antibiotic', 'dental'] },
    { name: 'Lignocaine Gel', defaultStrength: '2%', form: 'gel', timing: [0, 0, 0], food: 'any', duration: 5, tags: ['dental', 'topical'], instructions: 'Apply to affected area before eating' },
    { name: 'Chlorhexidine Mouthwash', defaultStrength: '0.2%', form: 'syrup', timing: [1, 0, 1], food: 'after', duration: 7, tags: ['dental'], instructions: 'Rinse for 30 seconds, do not swallow' },
    { name: 'Benzydamine Mouthwash', defaultStrength: '0.15%', form: 'syrup', timing: [1, 1, 1], food: 'after', duration: 7, tags: ['dental'], instructions: 'Gargle for 30 seconds after meals' },
    { name: 'Hydrogen Peroxide', defaultStrength: '1.5%', form: 'syrup', timing: [1, 0, 1], food: 'after', duration: 5, tags: ['dental'], instructions: 'Dilute 1:1 with water, rinse only' },
    { name: 'Doxycycline', defaultStrength: '100mg', form: 'capsule', timing: [1, 0, 0], food: 'after', duration: 7, tags: ['antibiotic', 'dental'] },
    { name: 'Ketorolac', defaultStrength: '10mg', form: 'tablet', timing: [1, 1, 1], food: 'after', duration: 3, tags: ['pain', 'dental'] },
    { name: 'Tramadol', defaultStrength: '50mg', form: 'capsule', timing: [1, 0, 1], food: 'after', duration: 3, tags: ['pain', 'dental'] },
    { name: 'Triamcinolone Paste', defaultStrength: '0.1%', form: 'cream', timing: [0, 0, 0], food: 'any', duration: 7, tags: ['dental', 'topical'], instructions: 'Apply to mouth ulcers at bedtime' },
    { name: 'Nystatin', defaultStrength: '1 lakh units', form: 'syrup', timing: [1, 1, 1], food: 'after', duration: 14, tags: ['dental', 'antifungal'], instructions: 'Swish and swallow' },
    { name: 'Fluconazole', defaultStrength: '150mg', form: 'tablet', timing: [1, 0, 0], food: 'any', duration: 7, tags: ['antifungal', 'dental'] },
]
