/**
 * PharmacyInvitePanel.tsx
 * ─────────────────────────────────────────────────────────────────
 * Drop this anywhere in the Doctor's settings/profile page.
 * It lets a doctor generate a one-time pharmacy invite link.
 *
 * Usage:
 *   import PharmacyInvitePanel from './components/Doctor/PharmacyInvitePanel';
 *   <PharmacyInvitePanel clinicId={clinic.id} doctorProfileId={session.user.id} />
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/db';
import { Link2, Copy, CheckCheck, RefreshCw, ShieldCheck, Clock, Store, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    clinicId: string;
    doctorProfileId: string;
}

interface Invite {
    id: string;
    token: string;
    status: string;
    expires_at: string;
    created_at: string;
}

interface LinkedPharmacy {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    created_at: string;
}

const PharmacyInvitePanel: React.FC<Props> = ({ clinicId, doctorProfileId }) => {
    const [invite, setInvite] = useState<Invite | null>(null);
    const [linkedPharmacy, setLinkedPharmacy] = useState<LinkedPharmacy | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const inviteUrl = invite
        ? `${window.location.origin}/pharmacy-signup?token=${invite.token}`
        : null;

    useEffect(() => {
        loadData();
    }, [clinicId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Check if a pharmacy is already linked
            const { data: pharmacy } = await supabase
                .from('pharmacies')
                .select('id, name, phone, address, created_at')
                .eq('clinic_id', clinicId)
                .maybeSingle();

            if (pharmacy) {
                setLinkedPharmacy(pharmacy);
                setLoading(false);
                return;
            }

            // Check for a pending invite
            const { data: existingInvite } = await supabase
                .from('pharmacy_invites')
                .select('id, token, status, expires_at, created_at')
                .eq('clinic_id', clinicId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingInvite) {
                // Check it's not expired locally
                if (new Date(existingInvite.expires_at) > new Date()) {
                    setInvite(existingInvite);
                }
            }
        } catch (err) {
            console.error('PharmacyInvitePanel load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateInvite = async () => {
        setGenerating(true);
        try {
            // Expire any old pending invites first
            await supabase
                .from('pharmacy_invites')
                .update({ status: 'expired' })
                .eq('clinic_id', clinicId)
                .eq('status', 'pending');

            const { data, error } = await supabase
                .from('pharmacy_invites')
                .insert({
                    clinic_id: clinicId,
                    created_by: doctorProfileId,
                })
                .select('id, token, status, expires_at, created_at')
                .single();

            if (error) throw error;
            setInvite(data);
            toast.success('Invite link generated! Share it only with your pharmacy.');
        } catch (err: any) {
            toast.error('Failed to generate invite: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const copyLink = async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
    };

    const formatExpiry = (expiresAt: string) => {
        const diff = new Date(expiresAt).getTime() - Date.now();
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hours > 0) return `${hours}h ${mins}m remaining`;
        return `${mins}m remaining`;
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
        );
    }

    // ── Already linked ──
    if (linkedPharmacy) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-200">
                        <Store size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900 text-sm">Linked Pharmacy</h3>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                <ShieldCheck size={10} />
                                VERIFIED
                            </span>
                        </div>
                        <p className="text-base font-bold text-emerald-800">{linkedPharmacy.name}</p>
                        {linkedPharmacy.phone && (
                            <p className="text-xs text-slate-500 mt-0.5">{linkedPharmacy.phone}</p>
                        )}
                        {linkedPharmacy.address && (
                            <p className="text-xs text-slate-400 mt-0.5">{linkedPharmacy.address}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-2">
                            Prescriptions will be sent here automatically when you complete a visit.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                        <Store size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Local Pharmacy Link</h3>
                        <p className="text-xs text-slate-400">Connect the ground-floor store to your clinic</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-4">
                {/* Security notice */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Pharmacies are <strong>invite-only</strong>. Only share this link with your trusted pharmacist.
                        The link expires in 48 hours and can only be used once.
                    </p>
                </div>

                {invite ? (
                    <div className="space-y-3">
                        {/* Invite link box */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Invite Link</p>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-600 font-mono truncate flex-1 min-w-0">{inviteUrl}</p>
                                <button
                                    onClick={copyLink}
                                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>

                        {/* Expiry */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Clock size={12} />
                                <span>{formatExpiry(invite.expires_at)}</span>
                            </div>
                            <button
                                onClick={generateInvite}
                                disabled={generating}
                                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
                                Generate new link
                            </button>
                        </div>

                        {/* Instructions */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instructions for pharmacist</p>
                            <ol className="space-y-1">
                                {[
                                    'Send this link to your pharmacist via WhatsApp',
                                    'They open the link and create their account',
                                    'Their dashboard is automatically linked to your clinic',
                                    'Prescriptions will appear instantly when you complete a visit',
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                        <span className="flex-shrink-0 w-4 h-4 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5">
                                            {i + 1}
                                        </span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={generateInvite}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 active:scale-[0.98]"
                    >
                        {generating ? (
                            <RefreshCw size={16} className="animate-spin" />
                        ) : (
                            <Link2 size={16} />
                        )}
                        {generating ? 'Generating...' : 'Generate Pharmacy Invite Link'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default PharmacyInvitePanel;