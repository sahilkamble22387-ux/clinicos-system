export interface ClinicProfile {
    id: string
    name: string
    owner_id: string
    created_at: string
    updated_at: string | null

    // Doctor's legal identity
    doctor_name: string | null
    qualifications: string | null
    registration_number: string | null
    specialization: string | null
    experience_years: number | null

    // Contact
    phone_number: string | null

    // Clinic details
    clinic_name_override: string | null
    clinic_address: string | null
    clinic_email: string | null
    clinic_timings: string | null

    // Signature (base64 without data: prefix)
    signature_base64: string | null

    // Doctor stamp (base64, optional)
    stamp_base64: string | null

    // Onboarding gate
    onboarding_completed: boolean
}

export interface OnboardingFormData {
    doctor_name: string
    qualifications: string
    registration_number: string
    specialization: string
    experience_years: string

    phone_number: string
    clinic_name_override: string
    clinic_address: string
    clinic_email: string
    clinic_timings: string

    signature_base64: string | null
    stamp_base64: string | null
}

export const QUALIFICATION_PRESETS = [
    'MBBS',
    'MBBS, MD - General Medicine',
    'MBBS, MS - General Surgery',
    'MBBS, MD - Paediatrics',
    'MBBS, MD - Dermatology',
    'MBBS, MD - Psychiatry',
    'MBBS, DNB - Family Medicine',
    'BDS',
    'BDS, MDS - Oral Surgery',
    'BAMS',
    'BHMS',
    'BUMS',
    'MBBS, DGO - Obstetrics & Gynaecology',
    'MBBS, MS - Orthopaedics',
    'MBBS, MD - Radiology',
    'MBBS, DM - Cardiology',
]

export const SPECIALIZATION_OPTIONS = [
    'General Physician',
    'General Surgeon',
    'Paediatrician',
    'Dermatologist',
    'Psychiatrist',
    'Gynaecologist',
    'Orthopaedic Surgeon',
    'Cardiologist',
    'ENT Specialist',
    'Ophthalmologist',
    'Neurologist',
    'Gastroenterologist',
    'Urologist',
    'Pulmonologist',
    'Endocrinologist',
    'Oncologist',
    'Dentist',
    'Ayurvedic Physician',
    'Homeopathic Physician',
    'Physiotherapist',
]
