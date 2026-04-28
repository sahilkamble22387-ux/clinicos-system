import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface DrugConflictAlertProps {
  newDrug: string;
  existingMedications: string[];
  knownConditions?: string[];
  allergies?: string[];
  clinicId?: string;
  onOverrideReason?: (reason: string) => void;
}

interface DrugCheckResult {
  risk_level: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  recommendation: string;
  conflicts: Array<{ with: string; reason: string; severity: string }>;
}

export default function DrugConflictAlert({
  newDrug,
  existingMedications,
  knownConditions = [],
  allergies = [],
  clinicId,
  onOverrideReason,
}: DrugConflictAlertProps) {
  const [result, setResult] = useState<DrugCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (!newDrug.trim()) {
      setResult(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch('/api/ai/drug-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
        },
        body: JSON.stringify({
          new_drug: newDrug,
          existing_medications: existingMedications,
          known_conditions: knownConditions,
          allergies,
        }),
      })
        .then((response) => response.ok ? response.json() : Promise.reject(response))
        .then(setResult)
        .catch(() => setResult(null))
        .finally(() => setLoading(false));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [allergies, clinicId, existingMedications, knownConditions, newDrug]);

  if (loading) return <span className="text-sm text-slate-500">Checking medicine...</span>;
  if (!result) return null;

  if (result.risk_level === 'none') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> No conflict found
      </span>
    );
  }

  if (result.risk_level === 'low') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-1 text-sm text-yellow-800">
        <Info className="h-4 w-4" aria-hidden="true" /> {result.recommendation}
      </span>
    );
  }

  const serious = result.risk_level === 'high' || result.risk_level === 'critical';

  return (
    <div className={`rounded-md border p-3 text-sm ${serious ? 'border-red-300 bg-red-50 text-red-900' : 'border-orange-300 bg-orange-50 text-orange-900'}`}>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {result.risk_level.toUpperCase()} risk
      </div>
      <p>{result.recommendation}</p>
      {result.conflicts.map((conflict, index) => (
        <p key={`${conflict.with}-${index}`} className="mt-1 text-xs">
          {conflict.with}: {conflict.reason}
        </p>
      ))}
      {serious && (
        <div className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-red-200 px-2 py-1"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Reason to override"
          />
          <button
            type="button"
            className="rounded-md bg-red-700 px-3 py-1 text-white disabled:opacity-50"
            disabled={!overrideReason.trim()}
            onClick={() => onOverrideReason?.(overrideReason)}
          >
            Override
          </button>
        </div>
      )}
    </div>
  );
}
