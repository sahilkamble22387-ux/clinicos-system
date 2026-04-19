import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Building2,
    CheckCheck,
    Clock,
    Copy,
    Link as LinkIcon,
    Link2,
    Loader2,
    RefreshCw,
    Search,
    ShieldCheck,
    Star,
    Store,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/db';

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

interface LinkedPharmacyCard {
    linkId: string;
    pharmacyId: string;
    name: string;
    phone: string | null;
    city: string | null;
    linkStatus: string;
    isPrimary: boolean;
    contactStatus: string;
    createdAt: string;
}

interface PharmacySearchResult {
    id: string;
    name: string;
    city: string | null;
    is_verified: boolean | null;
    license_number: string | null;
}

function createInviteToken() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 24 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function formatExpiry(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.max(0, Math.floor(diff / 3600000));
    const mins = Math.max(0, Math.floor((diff % 3600000) / 60000));
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
}

function getStatusTone(status: string) {
    switch ((status || '').toLowerCase()) {
        case 'active':
        case 'approved':
            return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
        case 'pending':
            return 'bg-amber-50 text-amber-700 border border-amber-100';
        default:
            return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
}

function getDisplayStatus(card: Pick<LinkedPharmacyCard, 'linkStatus' | 'contactStatus'>) {
    if (card.linkStatus?.trim()) return card.linkStatus;
    return card.contactStatus;
}

const PharmacyInvitePanel: React.FC<Props> = ({ clinicId, doctorProfileId }) => {
    const [invite, setInvite] = useState<Invite | null>(null);
    const [linkedPharmacies, setLinkedPharmacies] = useState<LinkedPharmacyCard[]>([]);
    const [pendingRequests, setPendingRequests] = useState<LinkedPharmacyCard[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PharmacySearchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [actingPharmacyId, setActingPharmacyId] = useState<string | null>(null);
    const [usingLegacyMode, setUsingLegacyMode] = useState(false);

    const inviteUrl = invite
        ? `${window.location.origin}/pharmacy/signup?token=${invite.token}`
        : null;

    const linkedPharmacyIds = useMemo(() => new Set(linkedPharmacies.map(item => item.pharmacyId)), [linkedPharmacies]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [pendingInvite, linkRows, directRows, defaultSetting] = await Promise.all([
                (supabase as any)
                    .from('pharmacy_invites')
                    .select('id, token, status, expires_at, created_at')
                    .eq('clinic_id', clinicId)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                (supabase as any)
                    .from('pharmacy_clinic_links')
                    .select('id, pharmacy_id, status, is_primary, created_at, pharmacies(name, phone, city, is_verified)')
                    .eq('clinic_id', clinicId)
                    .order('is_primary', { ascending: false })
                    .order('created_at', { ascending: false }),
                (supabase as any)
                    .from('pharmacies')
                    .select('id, clinic_id, name, phone, city, is_verified, created_at')
                    .eq('clinic_id', clinicId)
                    .order('created_at', { ascending: false }),
                (supabase as any)
                    .from('clinic_settings')
                    .select('value')
                    .eq('key', `clinic:${clinicId}:default_pharmacy_id`)
                    .maybeSingle(),
            ]);

            const existingInvite = pendingInvite.data;
            if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
                setInvite(existingInvite as Invite);
            } else {
                setInvite(null);
            }

            if (!linkRows.error) {
                const cards = ((linkRows.data ?? []) as any[]).map((row) => ({
                    linkId: row.id,
                    pharmacyId: row.pharmacy_id,
                    name: row.pharmacies?.name ?? 'Pharmacy',
                    phone: row.pharmacies?.phone ?? null,
                    city: row.pharmacies?.city ?? null,
                    linkStatus: row.status ?? 'pending',
                    isPrimary: Boolean(row.is_primary),
                    contactStatus: row.pharmacies?.is_verified ? 'active' : 'pending',
                    createdAt: row.created_at,
                })) as LinkedPharmacyCard[];

                const directLinkedRows = ((directRows.data ?? []) as any[]);
                const defaultPharmacyId = typeof defaultSetting.data?.value === 'string' ? defaultSetting.data.value : null;
                const existingPharmacyIds = new Set(cards.map(card => card.pharmacyId));

                directLinkedRows.forEach((row) => {
                    if (existingPharmacyIds.has(row.id)) return;
                    cards.push({
                        linkId: row.id,
                        pharmacyId: row.id,
                        name: row.name ?? 'Pharmacy',
                        phone: row.phone ?? null,
                        city: row.city ?? null,
                        linkStatus: 'active',
                        isPrimary: row.id === defaultPharmacyId,
                        contactStatus: row.is_verified ? 'active' : 'pending',
                        createdAt: row.created_at ?? new Date().toISOString(),
                    });
                });

                setUsingLegacyMode(false);
                setLinkedPharmacies(cards.filter(card => card.linkStatus !== 'pending'));
                setPendingRequests(cards.filter(card => card.linkStatus === 'pending'));
                return;
            }

            const [pharmaciesRes, profilesRes, fallbackDefaultSetting] = await Promise.all([
                (supabase as any)
                    .from('pharmacies')
                    .select('id, clinic_id, name, phone, city, is_verified, created_at')
                    .eq('clinic_id', clinicId)
                    .order('created_at', { ascending: false }),
                (supabase as any)
                    .from('profiles')
                    .select('id, pharmacy_id, clinic_id, full_name, role')
                    .eq('role', 'pharmacy_staff')
                    .eq('clinic_id', clinicId),
                (supabase as any)
                    .from('clinic_settings')
                    .select('value')
                    .eq('key', `clinic:${clinicId}:default_pharmacy_id`)
                    .maybeSingle(),
            ]);

            const byId = new Map<string, LinkedPharmacyCard>();
            (pharmaciesRes.data ?? []).forEach((row: any) => {
                byId.set(row.id, {
                    linkId: row.id,
                    pharmacyId: row.id,
                    name: row.name ?? 'Pharmacy',
                    phone: row.phone ?? null,
                    city: row.city ?? null,
                    linkStatus: 'active',
                    isPrimary: false,
                    contactStatus: row.is_verified ? 'active' : 'pending',
                    createdAt: row.created_at ?? new Date().toISOString(),
                });
            });
            (profilesRes.data ?? []).forEach((row: any) => {
                const pharmacyId = row.pharmacy_id ?? row.id;
                if (byId.has(pharmacyId)) return;
                byId.set(pharmacyId, {
                    linkId: pharmacyId,
                    pharmacyId,
                    name: row.full_name ?? 'Pharmacy',
                    phone: null,
                    city: null,
                    linkStatus: 'active',
                    isPrimary: false,
                    contactStatus: 'pending',
                    createdAt: new Date(0).toISOString(),
                });
            });

            const defaultPharmacyId = typeof fallbackDefaultSetting.data?.value === 'string' ? fallbackDefaultSetting.data.value : null;
            const cards = Array.from(byId.values()).map(card => ({
                ...card,
                isPrimary: card.pharmacyId === defaultPharmacyId,
            }));

            setUsingLegacyMode(true);
            setLinkedPharmacies(cards);
            setPendingRequests([]);
        } catch (error) {
            console.error('PharmacyInvitePanel load error:', error);
            toast.error('Could not load pharmacy links right now.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [clinicId]);

    useEffect(() => {
        const runSearch = async () => {
            const term = searchTerm.trim();
            if (term.length < 2) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            try {
                let query = await (supabase as any)
                    .from('pharmacies')
                    .select('id, name, city, is_verified, license_number')
                    .or(`name.ilike.%${term}%,license_number.ilike.%${term}%`)
                    .order('name', { ascending: true })
                    .limit(10);

                if (query.error) {
                    query = await (supabase as any)
                        .from('pharmacies')
                        .select('id, name, city, is_verified, license_number')
                        .ilike('name', `%${term}%`)
                        .order('name', { ascending: true })
                        .limit(10);
                }

                const rows = (query.data ?? []) as PharmacySearchResult[];
                setSearchResults(rows.filter(row => !linkedPharmacyIds.has(row.id)));
            } catch (error) {
                console.error('Pharmacy search error:', error);
                toast.error('Could not search pharmacies right now.');
            } finally {
                setSearching(false);
            }
        };

        const timeout = window.setTimeout(() => {
            void runSearch();
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [linkedPharmacyIds, searchTerm]);

    const generateInvite = async () => {
        setGenerating(true);
        try {
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
            setInvite(data as Invite);
            toast.success('Invite link generated. Share it with your pharmacy.');
        } catch (error: any) {
            toast.error(`Failed to generate invite: ${error.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const copyLink = async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        toast.success('Invite link copied to clipboard.');
        window.setTimeout(() => setCopied(false), 3000);
    };

    const handleSetPrimary = async (card: LinkedPharmacyCard) => {
        setActingPharmacyId(card.pharmacyId);
        try {
            if (!usingLegacyMode) {
                const { error: clearError } = await (supabase as any)
                    .from('pharmacy_clinic_links')
                    .update({ is_primary: false })
                    .eq('clinic_id', clinicId);
                if (clearError) throw clearError;

                const { error: primaryError } = await (supabase as any)
                    .from('pharmacy_clinic_links')
                    .update({ is_primary: true, status: card.linkStatus === 'pending' ? 'active' : card.linkStatus })
                    .eq('id', card.linkId);
                if (primaryError) throw primaryError;
            } else {
                const { error } = await (supabase as any)
                    .from('clinic_settings')
                    .upsert({
                        key: `clinic:${clinicId}:default_pharmacy_id`,
                        value: card.pharmacyId,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'key' });
                if (error) throw error;
            }

            toast.success('Primary pharmacy updated.');
            await loadData();
        } catch (error: any) {
            toast.error(`Failed to set primary pharmacy: ${error.message}`);
        } finally {
            setActingPharmacyId(null);
        }
    };

    const handleSendLinkRequest = async (pharmacy: PharmacySearchResult) => {
        setActingPharmacyId(pharmacy.id);
        try {
            const existing = await (supabase as any)
                .from('pharmacy_clinic_links')
                .select('id, status')
                .eq('clinic_id', clinicId)
                .eq('pharmacy_id', pharmacy.id)
                .maybeSingle();

            if (!existing.error && existing.data) {
                toast('A link request already exists for this pharmacy.', { icon: 'ℹ️' });
                return;
            }

            const { error } = await (supabase as any)
                .from('pharmacy_clinic_links')
                .insert({
                    clinic_id: clinicId,
                    pharmacy_id: pharmacy.id,
                    status: 'pending',
                    is_primary: false,
                });

            if (error) throw error;
            toast.success('Link request sent to pharmacy.');
            setSearchTerm('');
            setSearchResults([]);
            await loadData();
        } catch (error: any) {
            toast.error(`Failed to send link request: ${error.message}`);
        } finally {
            setActingPharmacyId(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 w-1/3 rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                    <div className="h-24 rounded-2xl bg-slate-100" />
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-6 py-5 text-white">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                        <Store size={19} />
                    </div>
                    <div>
                        <h3 className="text-base font-black">Pharmacy Linking</h3>
                        <p className="mt-1 text-sm text-slate-300">
                            Invite new pharmacies, link existing ones, and keep one primary destination for prescriptions.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-5 p-6">
                {usingLegacyMode && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <p className="text-xs font-medium leading-relaxed text-amber-800">
                            `pharmacy_clinic_links` was not readable in this environment, so this section is showing the older direct clinic-pharmacy link model as a fallback.
                        </p>
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-500">Linked</p>
                        <p className="mt-2 text-3xl font-black text-emerald-900">{linkedPharmacies.length}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-500">Pending Requests</p>
                        <p className="mt-2 text-3xl font-black text-amber-900">{pendingRequests.length}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">Primary</p>
                        <p className="mt-2 truncate text-sm font-black text-indigo-900">
                            {linkedPharmacies.find(card => card.isPrimary)?.name ?? 'Not set'}
                        </p>
                    </div>
                </div>

                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-black text-slate-900">Invite a new pharmacy</h4>
                            <p className="mt-1 text-xs text-slate-500">
                                Generate a one-time onboarding link for a pharmacy that has not signed up yet.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={generateInvite}
                            disabled={generating}
                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
                            {invite ? 'Rotate invite' : 'New invite'}
                        </button>
                    </div>

                    {invite ? (
                        <>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Active Invite Link</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">{inviteUrl}</p>
                                    <button
                                        type="button"
                                        onClick={copyLink}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                                    >
                                        {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <Clock size={12} />
                                {formatExpiry(invite.expires_at)}
                            </div>
                        </>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                            No active invite right now. Generate one whenever you need to onboard a fresh pharmacy account.
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-emerald-500" />
                        <h4 className="text-sm font-black text-slate-900">Linked pharmacies</h4>
                    </div>

                    {linkedPharmacies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            No linked pharmacy is active yet. Invite one above or send a request to an existing pharmacy below.
                        </div>
                    ) : (
                        linkedPharmacies.map(card => {
                            const displayStatus = getDisplayStatus(card);
                            const isBusy = actingPharmacyId === card.pharmacyId;
                            return (
                                <div key={card.linkId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-base font-black text-slate-900">{card.name}</p>
                                                {card.isPrimary && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                                                        <Star size={11} />
                                                        Primary
                                                    </span>
                                                )}
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${getStatusTone(displayStatus)}`}>
                                                    {displayStatus}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">
                                                {[card.phone, card.city].filter(Boolean).join(' · ') || 'Contact details not available'}
                                            </p>
                                        </div>

                                        {!card.isPrimary && (
                                            <button
                                                type="button"
                                                onClick={() => handleSetPrimary(card)}
                                                disabled={isBusy}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60"
                                            >
                                                {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                                                Set as Primary
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <div>
                        <h4 className="text-sm font-black text-slate-900">Link an existing pharmacy</h4>
                        <p className="mt-1 text-xs text-slate-500">
                            Search by pharmacy name or registration number and send a link request for approval.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search size={15} className="text-slate-300" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder="Search pharmacies by name or registration number"
                            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                        />
                    </div>

                    {searching ? (
                        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
                            <Loader2 size={14} className="animate-spin" />
                            Searching pharmacies...
                        </div>
                    ) : searchTerm.trim().length >= 2 ? (
                        searchResults.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                                No matching pharmacy was found.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {searchResults.map(result => {
                                    const isBusy = actingPharmacyId === result.id;
                                    return (
                                        <div key={result.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-black text-slate-900">{result.name}</p>
                                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${result.is_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {result.is_verified ? 'Active' : 'Pending'}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {[result.city, result.license_number].filter(Boolean).join(' · ') || 'Registration not available'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSendLinkRequest(result)}
                                                disabled={isBusy}
                                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                            >
                                                {isBusy ? <Loader2 size={13} className="animate-spin" /> : <LinkIcon size={13} />}
                                                Send Link Request
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                            Start typing at least 2 characters to search the pharmacy directory.
                        </div>
                    )}

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-amber-500" />
                            <h5 className="text-sm font-black text-slate-900">Pending requests</h5>
                        </div>

                        {pendingRequests.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                                No outgoing pharmacy requests are waiting for acceptance.
                            </div>
                        ) : (
                            pendingRequests.map(card => (
                                <div key={card.linkId} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{card.name}</p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {[card.city, card.phone].filter(Boolean).join(' · ') || 'Awaiting pharmacy confirmation'}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-amber-100 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                            Pending
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PharmacyInvitePanel;
