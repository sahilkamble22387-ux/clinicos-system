import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface CaseSummaryBadgeProps {
  frontDeskId: string;
  clinicId?: string;
}

export default function CaseSummaryBadge({ frontDeskId, clinicId }: CaseSummaryBadgeProps) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [emptyState, setEmptyState] = useState(false);

  useEffect(() => {
    if (!frontDeskId) return;
    let cancelled = false;

    setLoading(true);
    setUnavailable(false);
    setEmptyState(false);
    fetch('/api/ai/case-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
      },
      body: JSON.stringify({ frontDeskId }),
      })
      .then(async (response) => {
        if (response.ok) return response.json();
        const errorBody = await response.json().catch(() => null);
        if (response.status === 404 || errorBody?.error === 'patient_not_found') {
          if (!cancelled) setEmptyState(true);
          return null;
        }
        throw response;
      })
      .then((data) => {
        if (!cancelled && data) setSummary(data.summary ?? '');
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clinicId, frontDeskId]);

  if (loading) {
    return <div className="h-9 w-full animate-pulse rounded-md bg-slate-100" aria-label="Loading AI summary" />;
  }

  if (emptyState) {
    return <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">No AI summary yet</span>;
  }

  if (unavailable) {
    return <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">AI unavailable</span>;
  }

  if (!summary) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-slate-800">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
      <span>{summary}</span>
    </div>
  );
}
