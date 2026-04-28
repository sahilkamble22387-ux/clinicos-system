import React, { useState } from 'react';
import { FileText } from 'lucide-react';

interface SoapNoteScribeProps {
  visitId?: string;
  frontDeskId?: string;
  clinicId?: string;
  onApplySoap?: (soap: Record<string, string>) => void;
}

export default function SoapNoteScribe({ visitId, frontDeskId, clinicId, onApplySoap }: SoapNoteScribeProps) {
  const [transcript, setTranscript] = useState('');
  const [soap, setSoap] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const generate = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch('/api/ai/soap-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
        },
        body: JSON.stringify({ transcript, visitId, frontDeskId }),
      });
      if (!response.ok) throw new Error('SOAP unavailable');
      const data = await response.json();
      setSoap(data.soap);
      onApplySoap?.(data.soap);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        className="min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm"
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="Paste or type visit transcript"
      />
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={loading || !transcript.trim()}
        onClick={generate}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Structuring...' : 'Generate SOAP'}
      </button>
      {unavailable && <p className="text-sm text-slate-500">AI unavailable</p>}
      {soap && (
        <div className="grid gap-2 text-sm md:grid-cols-2">
          {Object.entries(soap).map(([key, value]) => (
            <div key={key} className="rounded-md border border-slate-200 p-3">
              <div className="mb-1 font-semibold capitalize text-slate-700">{key}</div>
              <p className="text-slate-600">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
