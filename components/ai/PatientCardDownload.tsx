import React, { useState } from 'react';
import { Download } from 'lucide-react';

interface PatientCardDownloadProps {
  payload: Record<string, unknown>;
  clinicId?: string;
}

export default function PatientCardDownload({ payload, clinicId }: PatientCardDownloadProps) {
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const download = async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch('/api/ai/patient-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
        },
        body: JSON.stringify({ ...payload, clinicId, format: 'pdf' }),
      });
      if (!response.ok) throw new Error('PDF unavailable');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nirogai-patient-card.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={loading}
        onClick={download}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Preparing...' : 'Patient card'}
      </button>
      {unavailable && <span className="text-sm text-slate-500">AI unavailable</span>}
    </div>
  );
}
