
import { Patient, Visit, Document, Prescription, Gender, VisitStatus } from './types';

// Initial Mock Data
const INITIAL_PATIENTS: Patient[] = [
  { id: 'p1', name: 'James Wilson', gender: Gender.MALE, dob: '1985-05-12', phone: '555-0101', address: '123 Oak St, NY', createdAt: new Date().toISOString() },
  { id: 'p2', name: 'Sarah Miller', gender: Gender.FEMALE, dob: '1992-08-24', phone: '555-0102', address: '456 Maple Ave, LA', createdAt: new Date().toISOString() },
];

const INITIAL_VISITS: Visit[] = [
  { id: 'v1', patientId: 'p1', arrivalTime: new Date(Date.now() - 3600000).toISOString(), status: VisitStatus.WAITING },
];

export class MockDB {
  private static patients = [...INITIAL_PATIENTS];
  private static visits = [...INITIAL_VISITS];
  private static documents: Document[] = [];
  private static prescriptions: Prescription[] = [];

  static getPatients() { return this.patients; }
  static addPatient(p: Omit<Patient, 'id' | 'createdAt'>) {
    const newP = { ...p, id: `p${this.patients.length + 1}`, createdAt: new Date().toISOString() };
    this.patients.push(newP);
    return newP;
  }

  static getVisits() { return this.visits; }
  static checkIn(patientId: string) {
    const newV: Visit = {
      id: `v${this.visits.length + 1}`,
      patientId,
      arrivalTime: new Date().toISOString(),
      status: VisitStatus.WAITING
    };
    this.visits.push(newV);
    return newV;
  }

  static updateVisit(visitId: string, updates: Partial<Visit>) {
    const idx = this.visits.findIndex(v => v.id === visitId);
    if (idx !== -1) this.visits[idx] = { ...this.visits[idx], ...updates };
  }

  static addDocument(doc: Omit<Document, 'id' | 'uploadedAt'>) {
    const newDoc = { ...doc, id: `d${this.documents.length + 1}`, uploadedAt: new Date().toISOString() };
    this.documents.push(newDoc);
    return newDoc;
  }

  static getPatientDocuments(patientId: string) {
    return this.documents.filter(d => d.patientId === patientId);
  }

  static getPatientHistory(patientId: string) {
    return this.visits.filter(v => v.patientId === patientId).sort((a,b) => b.arrivalTime.localeCompare(a.arrivalTime));
  }
}
