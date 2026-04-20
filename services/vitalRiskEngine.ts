/**
 * vitalRiskEngine.ts
 * Pure rule-based vitals risk flagging — zero API, zero cost, instant.
 * Drop this file in: src/services/vitalRiskEngine.ts
 * Visible only inside Doctor Portal. Never shown to patients.
 */

export type RiskLevel = 'critical' | 'warning' | 'info'

export interface VitalFlag {
  level: RiskLevel
  vital: string
  value: string
  message: string
  action: string
}

export interface VitalsRiskResult {
  flags: VitalFlag[]
  highestLevel: RiskLevel | null
  /** Pattern message when multiple vitals combine into a clinical syndrome */
  combinedAlert: string | null
}

interface VitalsInput {
  bp_systolic: string
  bp_diastolic: string
  heart_rate: string
  temperature_f: string
  weight_kg: string
}

// ─── Individual vital checks ──────────────────────────────────────────────────

function checkBP(sys: number, dia: number): VitalFlag | null {
  if (sys >= 180 || dia >= 120) return {
    level: 'critical', vital: 'Blood Pressure', value: `${sys}/${dia} mmHg`,
    message: 'Hypertensive Crisis — BP is dangerously elevated.',
    action: 'Immediate attention required. Do not let patient leave.',
  }
  if (sys >= 140 || dia >= 90) return {
    level: 'warning', vital: 'Blood Pressure', value: `${sys}/${dia} mmHg`,
    message: 'Stage 2 Hypertension detected.',
    action: 'Consider antihypertensive therapy. Recheck in 15 minutes.',
  }
  if (sys >= 130 || dia >= 80) return {
    level: 'info', vital: 'Blood Pressure', value: `${sys}/${dia} mmHg`,
    message: 'Stage 1 Hypertension — borderline elevated.',
    action: 'Lifestyle counselling advised. Monitor closely.',
  }
  if (sys < 90 || dia < 60) return {
    level: 'warning', vital: 'Blood Pressure', value: `${sys}/${dia} mmHg`,
    message: 'Hypotension — BP is below normal range.',
    action: 'Check for dehydration, medication side effects, or cardiac causes.',
  }
  return null
}

function checkHR(hr: number): VitalFlag | null {
  if (hr > 130) return {
    level: 'critical', vital: 'Heart Rate', value: `${hr} bpm`,
    message: 'Severe Tachycardia — heart rate critically elevated.',
    action: 'Immediate ECG advised. Rule out arrhythmia.',
  }
  if (hr > 100) return {
    level: 'warning', vital: 'Heart Rate', value: `${hr} bpm`,
    message: 'Tachycardia — heart rate above normal range.',
    action: 'Investigate: pain, fever, anxiety, hyperthyroidism, or cardiac issue.',
  }
  if (hr < 50) return {
    level: 'critical', vital: 'Heart Rate', value: `${hr} bpm`,
    message: 'Severe Bradycardia — heart rate critically low.',
    action: 'Check for heart block or medication overdose. ECG recommended.',
  }
  if (hr < 60) return {
    level: 'info', vital: 'Heart Rate', value: `${hr} bpm`,
    message: 'Bradycardia — heart rate below normal range.',
    action: 'May be normal in athletes. Confirm patient is asymptomatic.',
  }
  return null
}

function checkTemp(tempF: number): VitalFlag | null {
  const tempC = ((tempF - 32) * 5 / 9).toFixed(1)
  if (tempF >= 104) return {
    level: 'critical', vital: 'Temperature', value: `${tempF}°F (${tempC}°C)`,
    message: 'Hyperpyrexia — dangerously high fever.',
    action: 'Immediate cooling. Rule out sepsis, meningitis, CNS infection.',
  }
  if (tempF >= 101) return {
    level: 'warning', vital: 'Temperature', value: `${tempF}°F (${tempC}°C)`,
    message: 'High Fever detected.',
    action: 'Antipyretics, hydration. Investigate source of infection.',
  }
  if (tempF >= 99.1) return {
    level: 'info', vital: 'Temperature', value: `${tempF}°F (${tempC}°C)`,
    message: 'Low-grade fever — slightly elevated.',
    action: 'Monitor temperature. Check for early infection signs.',
  }
  if (tempF < 96) return {
    level: 'warning', vital: 'Temperature', value: `${tempF}°F (${tempC}°C)`,
    message: 'Hypothermia — body temperature is abnormally low.',
    action: 'Warm patient. Check thyroid, sepsis, or cold exposure.',
  }
  return null
}

// ─── Combined pattern detection ───────────────────────────────────────────────
// Catches clinical syndromes that only appear when multiple vitals combine —
// something simple threshold rules alone can never do.

function detectCombinedPattern(
  sys: number | null, _dia: number | null,
  hr: number | null, tempF: number | null,
): string | null {
  if (tempF && hr && tempF >= 101 && hr > 100)
    return '🚨 Sepsis pattern: High fever + Tachycardia together. Consider blood cultures, CBC, CRP. Rule out systemic infection.'
  if (sys && hr && sys >= 160 && hr > 100)
    return '🚨 Hypertensive urgency: Severely elevated BP + Tachycardia. Cardiac stress likely. Immediate BP control advised.'
  if (sys && hr && sys < 90 && hr > 100)
    return '🚨 Shock pattern: Low BP + Tachycardia. Consider septic, hypovolemic, or cardiogenic shock. Urgent investigation.'
  if (sys && tempF && sys < 100 && tempF >= 101)
    return '🚨 Septic shock risk: Fever with hypotension. Urgent fluid resuscitation and cultures advised.'
  if (sys && tempF && sys >= 160 && tempF >= 103)
    return '⚠️ High BP + Hyperpyrexia: Consider hypertensive encephalopathy or CNS infection. Neurological exam recommended.'
  return null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeVitals(vitals: VitalsInput): VitalsRiskResult {
  const flags: VitalFlag[] = []

  const sys = vitals.bp_systolic   ? Number(vitals.bp_systolic)   : null
  const dia = vitals.bp_diastolic  ? Number(vitals.bp_diastolic)  : null
  const hr  = vitals.heart_rate    ? Number(vitals.heart_rate)    : null
  const tmp = vitals.temperature_f ? Number(vitals.temperature_f) : null

  if (sys && dia) { const f = checkBP(sys, dia); if (f) flags.push(f) }
  if (hr)         { const f = checkHR(hr);        if (f) flags.push(f) }
  if (tmp)        { const f = checkTemp(tmp);      if (f) flags.push(f) }

  const combinedAlert = detectCombinedPattern(sys, dia, hr, tmp)

  let highestLevel: RiskLevel | null = null
  if (flags.some(f => f.level === 'critical') || combinedAlert?.startsWith('🚨')) {
    highestLevel = 'critical'
  } else if (flags.some(f => f.level === 'warning') || combinedAlert?.startsWith('⚠️')) {
    highestLevel = 'warning'
  } else if (flags.length > 0) {
    highestLevel = 'info'
  }

  return { flags, highestLevel, combinedAlert }
}