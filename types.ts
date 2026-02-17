
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
}

export interface Clinic {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export type ViewMode = 'FRONT_DESK' | 'DOCTOR' | 'ANALYTICS';
