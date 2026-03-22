import React, { useCallback, useMemo, useState } from 'react';
import { Upload, Image as ImageIcon, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../services/db';
import { useLogo } from '../../context/LogoContext';
import { Logo } from '../Logo';
import { LABELS } from '../../constants/labels';

type FileState = {
  file: File;
  previewUrl: string;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg'];

export const LogoUpload: React.FC = () => {
  const { updateLogo, resetToDefaults } = useLogo();
  const [candidate, setCandidate] = useState<FileState | null>(null);
  const [uploading, setUploading] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload a PNG, SVG, or JPG image.';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return 'File is too large. Max size is 5MB.';
    }
    return null;
  }, []);

  const onFileSelected = useCallback(
    (file: File | null) => {
      if (!file) return;
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setCandidate({ file, previewUrl });
    },
    [validateFile],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onFileSelected(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0] ?? null;
    onFileSelected(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const canUpload = useMemo(() => !!candidate && !uploading, [candidate, uploading]);

  const performUpload = useCallback(async () => {
    if (!candidate) return;
    setUploading(true);
    try {
      const file = candidate.file;
      const bucket = 'brand-assets';

      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
      const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const client: any = supabase as any;
      if (!client?.storage) {
        throw new Error('Supabase storage is not configured for this project.');
      }

      const { error: uploadError } = await client.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(path);
      const publicUrl: string | undefined = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to resolve public URL for uploaded logo.');
      }

      await Promise.all([
        updateLogo('icon', publicUrl),
        updateLogo('full', publicUrl),
      ]);

      toast.success('Logo updated successfully.');
    } catch (err: any) {
      const message: string =
        err?.message ?? 'Failed to upload logo. Please try again.';
      // eslint-disable-next-line no-console
      console.error('[LogoUpload] Upload failed:', err);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [candidate, updateLogo]);

  const handleReset = useCallback(async () => {
    try {
      await resetToDefaults();
      setCandidate(null);
      toast.success('Logo reset to default.');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[LogoUpload] Reset failed:', err);
      toast.error('Failed to reset logo to default.');
    }
  }, [resetToDefaults]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Brand logo</h2>
          <p className="mt-1 text-xs text-slate-500">
            Upload once and NirogOS will update the logo everywhere across your workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={12} className="text-slate-500" />
          {LABELS.buttons.resetToDefault}
        </button>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="relative border-2 border-dashed rounded-xl border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors px-4 py-6 flex flex-col items-center justify-center text-center gap-3"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 mb-1">
          <Upload size={18} />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-800">
            Drag and drop logo, or{' '}
            <label className="text-indigo-600 font-semibold cursor-pointer hover:text-indigo-700">
              browse
              <input
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                className="sr-only"
                onChange={handleInputChange}
              />
            </label>
          </p>
          <p className="text-[11px] text-slate-500">
            PNG, SVG, or JPG up to 5MB.
          </p>
        </div>
        {candidate && (
          <button
            type="button"
            onClick={() => setCandidate(null)}
            className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-500"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">
              Live preview
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
            <div className="flex flex-col items-center justify-center bg-white py-3">
              <span className="text-[10px] text-slate-400 mb-1 font-medium">
                Icon · Light
              </span>
              {candidate ? (
                <img
                  src={candidate.previewUrl}
                  alt="Logo icon preview on light"
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <Logo variant="icon" usage="appLoader" theme="light" />
              )}
            </div>
            <div className="flex flex-col items-center justify-center bg-[#0C2828] py-3">
              <span className="text-[10px] text-slate-300 mb-1 font-medium">
                Icon · Dark
              </span>
              {candidate ? (
                <img
                  src={candidate.previewUrl}
                  alt="Logo icon preview on dark"
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <Logo variant="icon" usage="appLoader" theme="dark" />
              )}
            </div>
            <div className="flex flex-col items-center justify-center bg-white py-3 col-span-1">
              <span className="text-[10px] text-slate-400 mb-1 font-medium">
                Full · Light
              </span>
              {candidate ? (
                <img
                  src={candidate.previewUrl}
                  alt="Logo full preview on light"
                  className="h-8 max-w-[120px] object-contain"
                />
              ) : (
                <Logo variant="full" usage="navbar" theme="light" />
              )}
            </div>
            <div className="flex flex-col items-center justify-center bg-[#0C2828] py-3 col-span-1">
              <span className="text-[10px] text-slate-200 mb-1 font-medium">
                Full · Dark
              </span>
              {candidate ? (
                <img
                  src={candidate.previewUrl}
                  alt="Logo full preview on dark"
                  className="h-8 max-w-[120px] object-contain"
                />
              ) : (
                <Logo variant="full" usage="navbar" theme="dark" />
              )}
            </div>
          </div>
        </div>

        <div className="w-full md:w-[180px] flex flex-col justify-between gap-3">
          <button
            type="button"
            disabled={!canUpload}
            onClick={performUpload}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
            }}
          >
            {uploading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={14} className="text-white" />
                Save logo
              </>
            )}
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Changes apply instantly across the app. Existing sessions will see the new logo on their next page load.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogoUpload;

