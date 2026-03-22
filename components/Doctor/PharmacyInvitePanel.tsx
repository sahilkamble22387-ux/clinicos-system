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
import {
    Link2, Copy, CheckCheck, RefreshCw, ShieldCheck, Clock, Store, AlertTriangle, Link as LinkIcon,
    Unlink, Star, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    DoctorPharmacyNetwork,
    clearClinicDefaultPharmacy,
    fetchDoctorPharmacyNetwork,
    linkPharmacyToClinic,
    setClinicDefaultPharmacy,
    unlinkPharmacyFromClinic,
} from '../../services/pharmacyService';

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

function createInviteToken() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 24 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

const PharmacyInvitePanel: React.FC<Props> = ({ clinicId, doctorProfileId }) => {
    const [invite, setInvite] = useState<Invite | null>(null);
    const [network, setNetwork] = useState<DoctorPharmacyNetwork | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [actingPharmacyId, setActingPharmacyId] = useState<string | null>(null);

    const inviteUrl = invite
        ? `${window.location.origin}/pharmacy/signup?token=${invite.token}`
        : null;

    useEffect(() => {
        loadData();
    }, [clinicId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [pharmacyNetwork, pendingInvite] = await Promise.all([
                fetchDoctorPharmacyNetwork(clinicId),
                (supabase as any)
                    .from('pharmacy_invites')
                    .select('id, token, status, expires_at, created_at')
                    .eq('clinic_id', clinicId)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
            ]);

            setNetwork(pharmacyNetwork);

            const existingInvite = pendingInvite.data;
            if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
                setInvite(existingInvite as Invite);
            } else {
                setInvite(null);
            }
        } catch (err) {
            console.error('PharmacyInvitePanel load error:', err);
            toast.error('Could not load pharmacies right now.');
        } finally {
            setLoading(false);
        }
    };

    const generateInvite = async () => {
        setGenerating(true);
        try {
            // Expire any old pending invites first
            await (supabase as any)
                .from('pharmacy_invites')
                .update({ status: 'expired' })
                .eq('clinic_id', clinicId)
                .eq('status', 'pending');

            const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await (supabase as any)
                .from('pharmacy_invites')
                .insert({
                    clinic_id: clinicId,
                    created_by: doctorProfileId,
                    token: createInviteToken(),
                    expires_at: expiresAt,
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

    const handleLink = async (pharmacyId: string) => {
        setActingPharmacyId(pharmacyId);
        try {
            await linkPharmacyToClinic(clinicId, pharmacyId);
            if (!network?.defaultPharmacyId) {
                await setClinicDefaultPharmacy(clinicId, pharmacyId);
            }
            toast.success('Pharmacy linked to your clinic.');
            await loadData();
        } catch (err: any) {
            toast.error('Failed to link pharmacy: ' + err.message);
        } finally {
            setActingPharmacyId(null);
        }
    };

    const handleUnlink = async (pharmacyId: string) => {
        setActingPharmacyId(pharmacyId);
        try {
            if (network?.defaultPharmacyId === pharmacyId) {
                await clearClinicDefaultPharmacy(clinicId);
            }
            await unlinkPharmacyFromClinic(clinicId, pharmacyId);
            toast.success('Pharmacy unlinked from this clinic.');
            await loadData();
        } catch (err: any) {
            toast.error('Failed to unlink pharmacy: ' + err.message);
        } finally {
            setActingPharmacyId(null);
        }
    };

    const handleSetPrimary = async (pharmacyId: string) => {
        setActingPharmacyId(pharmacyId);
        try {
            await setClinicDefaultPharmacy(clinicId, pharmacyId);
            toast.success('Primary pharmacy updated.');
            await loadData();
        } catch (err: any) {
            toast.error('Failed to update primary pharmacy: ' + err.message);
        } finally {
            setActingPharmacyId(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
        );
    }

    const linkedPharmacies = network?.linkedPharmacies ?? [];
    const directoryPharmacies = network?.directoryPharmacies ?? [];

    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                        <Store size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Pharmacy Network</h3>
                        <p className="text-xs text-slate-400">Link signed-in pharmacies, set a primary store, and keep invite onboarding ready</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Pharmacies are <strong>invite-only</strong>. Only share this link with your trusted pharmacist.
                        Signed-in pharmacies can then be linked here and marked as your primary destination.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Linked</p>
                        <p className="text-2xl font-black text-emerald-800 mt-1">{linkedPharmacies.length}</p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Primary</p>
                        <p className="text-sm font-black text-indigo-900 mt-2 truncate">
                            {linkedPharmacies.find((pharmacy) => pharmacy.id === network?.defaultPharmacyId)?.name ?? 'Not set'}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Signed in</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{directoryPharmacies.length}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">Invite a new pharmacy</h4>
                            <p className="text-xs text-slate-500">Use this for pharmacies that have not created an account yet.</p>
                        </div>
                        <button
                            onClick={generateInvite}
                            disabled={generating}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200"
                        >
                            {generating ? <RefreshCw size={15} className="animate-spin" /> : <Link2 size={15} />}
                            {generating ? 'Generating...' : invite ? 'Rotate invite' : 'New invite'}
                        </button>
                    </div>

                    {invite && (
                        <>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Invite Link</p>
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

                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={12} />
                                    <span>{formatExpiry(invite.expires_at)}</span>
                                </div>
                                <span className="font-medium">One-time onboarding link</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <h4 className="text-sm font-bold text-slate-900">Linked pharmacies</h4>
                    </div>

                    {linkedPharmacies.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            No pharmacy is linked yet. Invite one or link a signed-in pharmacy below.
                        </div>
                    ) : (
                        linkedPharmacies.map((pharmacy) => {
                            const isPrimary = network?.defaultPharmacyId === pharmacy.id;
                            const isBusy = actingPharmacyId === pharmacy.id;
                            return (
                                <div key={pharmacy.id} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-emerald-900">{pharmacy.name}</p>
                                                {isPrimary && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                                        <Star size={10} />
                                                        PRIMARY
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {[pharmacy.owner_name, pharmacy.phone, pharmacy.city].filter(Boolean).join(' · ') || 'Signed-in pharmacy'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                            {!isPrimary && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetPrimary(pharmacy.id)}
                                                    disabled={isBusy}
                                                    className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold disabled:opacity-60"
                                                >
                                                    {isBusy ? 'Saving...' : 'Set primary'}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleUnlink(pharmacy.id)}
                                                disabled={isBusy}
                                                className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-xs font-bold disabled:opacity-60 inline-flex items-center gap-1"
                                            >
                                                <Unlink size={12} />
                                                {isBusy ? 'Updating...' : 'Unlink'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-slate-500" />
                        <h4 className="text-sm font-bold text-slate-900">Signed-in pharmacy directory</h4>
                    </div>

                    {directoryPharmacies.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            No pharmacy accounts have signed in yet.
                        </div>
                    ) : (
                        directoryPharmacies.map((pharmacy) => {
                            const isLinkedHere = pharmacy.clinic_id === clinicId;
                            const linkedElsewhere = Boolean(pharmacy.clinic_id && pharmacy.clinic_id !== clinicId);
                            const isPrimary = network?.defaultPharmacyId === pharmacy.id;
                            const isBusy = actingPharmacyId === pharmacy.id;
                            return (
                                <div key={pharmacy.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-slate-900">{pharmacy.name}</p>
                                                {isPrimary && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                                        <Star size={10} />
                                                        PRIMARY
                                                    </span>
                                                )}
                                                {isLinkedHere && (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                        LINKED HERE
                                                    </span>
                                                )}
                                                {!isLinkedHere && !linkedElsewhere && (
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                                        READY TO LINK
                                                    </span>
                                                )}
                                                {linkedElsewhere && (
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                                                        OTHER CLINIC
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {[pharmacy.owner_name, pharmacy.phone, pharmacy.city].filter(Boolean).join(' · ') || 'Signed-in pharmacy'}
                                            </p>
                                        </div>
                                        {!isLinkedHere && (
                                            <button
                                                type="button"
                                                onClick={() => handleLink(pharmacy.id)}
                                                disabled={isBusy || linkedElsewhere}
                                                className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1"
                                            >
                                                <LinkIcon size={12} />
                                                {isBusy ? 'Linking...' : linkedElsewhere ? 'Unavailable' : 'Link'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default PharmacyInvitePanel;
