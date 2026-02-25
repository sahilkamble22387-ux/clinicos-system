
export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other'
}

export enum VisitStatus {
  WAITING = 'Waiting',
  CONSULTING = 'Consulting',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export interface Patient {
  id: string;
  clinicId?: string;
  name: string;
  gender: Gender;
  dob: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  patientId: string;
  clinicId?: string;
  arrivalTime: string;
  status: VisitStatus;
  doctorNotes?: string;
  diagnosis?: string;
  completedAt?: string;
  patientName?: string;
  source?: string;
}

export interface Document {
  id: string;
  patientId: string;
  visitId?: string;
  type: 'Prescription' | 'Lab Report' | 'ID Proof' | 'Other';
  label: string;
  url: string;
  uploadedAt: string;
}

export interface Prescription {
  id: string;
  visitId: string;
  patientId: string;
  medications: Medication[];
  advice: string;
  date: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  clinicId?: string;
  diagnosis: string;
  prescription: string;
  doctorNotes: string;
  createdAt: string;
  // Supabase snake_case aliases
  patient_id?: string;
  clinic_id?: string;
  doctor_notes?: string;
  created_at?: string;
  fee_collected?: number;
  payment_method?: string;
}

export interface Clinic {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export type ViewMode = 'HOME' | 'FRONT_DESK' | 'DOCTOR' | 'ANALYTICS' | 'HISTORY';

// ── DB-aligned types (snake_case, matches Supabase schema exactly) ──

export interface DbPatient {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  gender: string | null;
  dob: string | null;
  status: 'waiting' | 'completed';
  source: 'Front_Desk' | 'QR_Checkin';
  is_active: boolean;
  clinic_id: string;
  consultation_fee: number;
  created_at: string;
  updated_at: string;
  appointments?: DbAppointment[];
}

export interface DbAppointment {
  id: string;
  patient_id: string;
  clinic_id: string;
  status: 'waiting' | 'completed';
  created_at: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  weight_kg: number | null;
  temperature_f: number | null;
}

export interface DbMedicalRecord {
  id: string;
  patient_id: string;
  clinic_id: string;
  diagnosis: string;
  prescription: string | null;
  doctor_notes: string | null;
  fee_collected: number;
  payment_method: string;
  created_at: string;
}

export interface DbProfile {
  id: string;
  clinic_id: string;
  role: string;
  full_name: string | null;
}
