// Call this on EVERY object before it touches the AI client.

export function sanitizeForAI<T extends Record<string, unknown>>(
  data: T,
  allowedKeys: readonly (keyof T)[]
): Partial<T> {
  const safe: Partial<T> = {};
  for (const key of allowedKeys) {
    if (key in data) safe[key] = data[key];
  }
  return safe;
}

export const PATIENT_SAFE_KEYS = [
  'front_desk_id',
  'age',
  'gender',
  'visit_history',
  'medications',
  'vitals',
  'chief_complaints',
  'diagnoses',
  'allergies',
  'missed_doses_flag',
  'last_visit_notes',
] as const;

const PII_KEYS = new Set([
  'patient_name',
  'name',
  'full_name',
  'phone',
  'phone_number',
  'mobile',
  'email',
  'address',
  'patientPhone',
  'patientName',
  'patientAddress',
]);

export function assertNoPIIKeys(data: unknown, path = 'payload'): void {
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    data.forEach((item, index) => assertNoPIIKeys(item, `${path}[${index}]`));
    return;
  }

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (PII_KEYS.has(key)) {
      throw new Error(`Unsafe PII key "${key}" detected at ${path}`);
    }
    assertNoPIIKeys(value, `${path}.${key}`);
  }
}
