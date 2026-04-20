import { supabase } from './db';

export interface PharmacyDirectoryItem {
    id: string;
    clinic_id: string | null;
    owner_name: string | null;
    name: string;
    license_number: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    pincode: string | null;
    is_verified: boolean | null;
    created_at: string;
}

export interface PharmacyProfileRow {
    role: string | null;
    pharmacy_id: string | null;
    clinic_id: string | null;
    full_name?: string | null;
}

export interface DoctorPharmacyNetwork {
    linkedPharmacies: PharmacyDirectoryItem[];
    directoryPharmacies: PharmacyDirectoryItem[];
    defaultPharmacyId: string | null;
}

interface PharmacySignupMetadata {
    pharmacy_name?: string;
    owner_name?: string;
    license_number?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    pincode?: string;
    clinic_id?: string | null;
    invite_token?: string | null;
}

function defaultPharmacyKey(clinicId: string) {
    return `clinic:${clinicId}:default_pharmacy_id`;
}

function readPharmacySignupMetadata(user: { user_metadata?: Record<string, unknown> }): PharmacySignupMetadata | null {
    const raw = user?.user_metadata?.pharmacy_signup;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as PharmacySignupMetadata;
}

async function persistPharmacyFromAuthMetadata(userId?: string): Promise<boolean> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return false;
    if (userId && user.id !== userId) return false;

    const pharmacy = readPharmacySignupMetadata(user);
    if (!pharmacy) return false;

    let clinicId = typeof pharmacy.clinic_id === 'string' && pharmacy.clinic_id.trim()
        ? pharmacy.clinic_id.trim()
        : null;

    const inviteToken = pharmacy.invite_token?.trim() || null;
    if (inviteToken) {
        const { data: inviteRow, error: inviteLookupError } = await supabase
            .from('pharmacy_invites')
            .select('clinic_id, status')
            .eq('token', inviteToken)
            .maybeSingle();

        if (inviteLookupError) {
            console.warn('[pharmacyService] Could not resolve invite token:', inviteLookupError);
        } else if (inviteRow?.clinic_id) {
            clinicId = inviteRow.clinic_id;
        }
    }

    const { error: pharmacyError } = await supabase
        .from('pharmacies')
        .upsert([{
            id: user.id,
            clinic_id: clinicId,
            owner_name: pharmacy.owner_name?.trim() || null,
            name: pharmacy.pharmacy_name?.trim() || 'Pharmacy',
            license_number: pharmacy.license_number?.trim() || null,
            phone: pharmacy.phone?.trim() || null,
            address: pharmacy.address?.trim() || null,
            city: pharmacy.city?.trim() || null,
            pincode: pharmacy.pincode?.trim() || null,
            is_verified: false,
        }], { onConflict: 'id' });
    if (pharmacyError) {
        console.warn('[pharmacyService] Could not upsert pharmacy directory row:', pharmacyError);
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
            id: user.id,
            role: 'pharmacy_staff',
            pharmacy_id: user.id,
            clinic_id: clinicId,
            full_name: pharmacy.owner_name?.trim() || (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'Pharmacy Staff',
        }], { onConflict: 'id' });

    if (profileError) throw profileError;

    if (inviteToken) {
        const { error: inviteError } = await supabase
            .from('pharmacy_invites')
            .update({ status: 'used' })
            .eq('token', inviteToken)
            .eq('status', 'pending');

        if (inviteError) {
            console.warn('[pharmacyService] Failed to mark invite as used:', inviteError);
        }
    }

    if (clinicId) {
        try {
            const { data: existingLink, error: existingLinkError } = await supabase
                .from('pharmacy_clinic_links')
                .select('id, status')
                .eq('clinic_id', clinicId)
                .eq('pharmacy_id', user.id)
                .maybeSingle();

            if (existingLinkError) {
                console.warn('[pharmacyService] Could not look up pharmacy_clinic_links row:', existingLinkError);
            } else if (existingLink?.id) {
                const { error: activateLinkError } = await supabase
                    .from('pharmacy_clinic_links')
                    .update({ status: 'active', updated_at: new Date().toISOString() })
                    .eq('id', existingLink.id);

                if (activateLinkError) {
                    console.warn('[pharmacyService] Could not activate pharmacy_clinic_links row:', activateLinkError);
                }
            } else {
                const { error: insertLinkError } = await supabase
                    .from('pharmacy_clinic_links')
                    .insert({
                        clinic_id: clinicId,
                        pharmacy_id: user.id,
                        status: 'active',
                        is_primary: false,
                    });

                if (insertLinkError) {
                    console.warn('[pharmacyService] Could not create pharmacy_clinic_links row:', insertLinkError);
                }
            }
        } catch (error) {
            console.warn('[pharmacyService] Link-table sync skipped:', error);
        }
    }

    return true;
}

export async function ensurePharmacyFromMetadata(userId?: string): Promise<void> {
    let directWriteError: unknown = null;

    try {
        const wroteDirectly = await persistPharmacyFromAuthMetadata(userId);
        if (wroteDirectly) return;
    } catch (error) {
        directWriteError = error;
    }

    const { error } = await supabase.rpc('ensure_pharmacy_from_metadata');
    if (error) {
        if (directWriteError) {
            throw directWriteError;
        }
        throw error;
    }
}

export async function fetchProfileRole(userId: string): Promise<PharmacyProfileRow | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('role, pharmacy_id, clinic_id, full_name')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return (data as PharmacyProfileRow | null) ?? null;
}

export async function syncAndFetchPharmacyProfile(userId: string): Promise<PharmacyProfileRow | null> {
    try {
        await ensurePharmacyFromMetadata(userId);
    } catch (error: unknown) {
        const message = String((error as { message?: string })?.message ?? '');
        console.warn('[pharmacyService] Metadata sync warning:', error);
        if (!message.toLowerCase().includes('ensure_pharmacy_from_metadata') && !message.toLowerCase().includes('row-level security')) {
            throw error;
        }
    }

    let profile = await fetchProfileRole(userId);
    if (profile) return profile;

    try {
        const wroteDirectly = await persistPharmacyFromAuthMetadata(userId);
        if (wroteDirectly) {
            profile = await fetchProfileRole(userId);
        }
    } catch (error) {
        console.warn('[pharmacyService] Metadata sync fallback failed:', error);
    }

    return profile;
}

export async function fetchDoctorPharmacyNetwork(clinicId: string): Promise<DoctorPharmacyNetwork> {
    // ── Step 1: Get linked pharmacy IDs via pharmacy_clinic_links (source of truth) ──
    const linkedPharmacyIds = new Set<string>();
    const { data: linkRows, error: linkError } = await supabase
        .from('pharmacy_clinic_links')
        .select('pharmacy_id, status, is_primary')
        .eq('clinic_id', clinicId)
        .in('status', ['active', 'approved']);

    if (!linkError && linkRows) {
        linkRows.forEach((row) => linkedPharmacyIds.add(row.pharmacy_id));
    } else {
        // Fallback: treat pharmacies with matching clinic_id as linked
        console.warn('[pharmacyService] pharmacy_clinic_links query failed, using legacy clinic_id fallback:', linkError);
    }

    // ── Step 2: Fetch all pharmacy directory rows ──────────────────────────────
    const { data: pharmacies, error: pharmaciesError } = await supabase
        .from('pharmacies')
        .select('id, clinic_id, owner_name, name, license_number, phone, address, city, pincode, is_verified, created_at')
        .order('created_at', { ascending: false });

    let all = (pharmacies ?? []) as PharmacyDirectoryItem[];

    if (pharmaciesError) {
        console.warn('[pharmacyService] Global pharmacy directory read failed, falling back to clinic-linked pharmacies only:', pharmaciesError);

        const { data: linkedOnly, error: linkedOnlyError } = await supabase
            .from('pharmacies')
            .select('id, clinic_id, owner_name, name, license_number, phone, address, city, pincode, is_verified, created_at')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false });

        if (linkedOnlyError) throw linkedOnlyError;
        all = (linkedOnly ?? []) as PharmacyDirectoryItem[];
    }

    // ── Step 3: Merge pharmacy profiles into directory entries ─────────────────
    const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, clinic_id, full_name, pharmacy_id, role')
        .eq('role', 'pharmacy_staff');

    if (profilesError) throw profilesError;

    const merged = new Map<string, PharmacyDirectoryItem>();

    // Only add pharmacies that actually exist in the DB (prevents FK violations)
    all.forEach((pharmacy) => {
        merged.set(pharmacy.id, pharmacy);
    });

    (profileRows ?? []).forEach((profile) => {
        const pharmacyId = (profile as { pharmacy_id?: string | null; id: string }).pharmacy_id || profile.id;
        const existing = merged.get(pharmacyId);
        
        // If the pharmacy row doesn't exist in the DB, it's not fully registered yet.
        // We only enhance existing directory rows with profile names.
        if (existing) {
            merged.set(pharmacyId, {
                ...existing,
                owner_name: existing.owner_name ?? profile.full_name ?? null,
                name: existing.name !== 'Pharmacy' ? existing.name : (profile.full_name ?? 'Pharmacy'),
            });
        }
    });

    const mergedPharmacies = Array.from(merged.values());

    // ── Step 4: Determine linked pharmacies using pharmacy_clinic_links ────────
    const linkedPharmacies = mergedPharmacies
        .filter(pharmacy =>
            linkedPharmacyIds.has(pharmacy.id) ||
            (!linkError && linkedPharmacyIds.size === 0 && pharmacy.clinic_id === clinicId) ||
            (linkError && pharmacy.clinic_id === clinicId)
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const linkedPharmacyIdSet = new Set(linkedPharmacies.map(p => p.id));

    const directoryPharmacies = mergedPharmacies
        .sort((a, b) => {
            const aLinked = linkedPharmacyIdSet.has(a.id);
            const bLinked = linkedPharmacyIdSet.has(b.id);
            if (aLinked && !bLinked) return -1;
            if (!aLinked && bLinked) return 1;
            if (!a.clinic_id && b.clinic_id) return -1;
            if (a.clinic_id && !b.clinic_id) return 1;
            return a.name.localeCompare(b.name);
        });

    // ── Step 5: Load default pharmacy preference ───────────────────────────────
    const { data: defaultSetting, error: defaultError } = await supabase
        .from('clinic_settings')
        .select('value')
        .eq('key', defaultPharmacyKey(clinicId))
        .maybeSingle();

    if (defaultError) {
        console.warn('[pharmacyService] Could not load clinic default pharmacy setting:', defaultError);
    }

    // Also check if there is a primary link in pharmacy_clinic_links
    const primaryLinkRow = !linkError && linkRows
        ? linkRows.find(r => r.is_primary)
        : null;
    const primaryFromLink = primaryLinkRow?.pharmacy_id ?? null;

    const savedDefault = typeof defaultSetting?.value === 'string' ? defaultSetting.value : null;
    const resolvedDefault = savedDefault || primaryFromLink;
    const defaultPharmacyId = linkedPharmacies.some(pharmacy => pharmacy.id === resolvedDefault)
        ? resolvedDefault
        : linkedPharmacies[0]?.id ?? null;

    return { linkedPharmacies, directoryPharmacies, defaultPharmacyId };
}

export async function setClinicDefaultPharmacy(clinicId: string, pharmacyId: string): Promise<void> {
    const { error } = await supabase
        .from('clinic_settings')
        .upsert({
            key: defaultPharmacyKey(clinicId),
            value: pharmacyId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    if (error) throw error;
}

export async function clearClinicDefaultPharmacy(clinicId: string): Promise<void> {
    const { error } = await supabase
        .from('clinic_settings')
        .delete()
        .eq('key', defaultPharmacyKey(clinicId));

    if (error) throw error;
}

export async function linkPharmacyToClinic(clinicId: string, pharmacyId: string): Promise<void> {
    // Update the direct FK on pharmacies
    const { error: pharmacyError } = await supabase
        .from('pharmacies')
        .update({ clinic_id: clinicId })
        .eq('id', pharmacyId);

    if (pharmacyError) {
        console.warn('[pharmacyService] Could not update pharmacy directory row during link:', pharmacyError);
    }

    // Update the profile so role-checks are consistent
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
            id: pharmacyId,
            role: 'pharmacy_staff',
            pharmacy_id: pharmacyId,
            clinic_id: clinicId,
        }], { onConflict: 'id' });

    if (profileError) throw profileError;

    // ── KEY FIX: Also ensure a pharmacy_clinic_links row exists ──────────────
    try {
        const { data: existing } = await supabase
            .from('pharmacy_clinic_links')
            .select('id, status')
            .eq('clinic_id', clinicId)
            .eq('pharmacy_id', pharmacyId)
            .maybeSingle();

        if (existing?.id) {
            // Row exists — make sure it's active
            await supabase
                .from('pharmacy_clinic_links')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            // No row yet — create one as active + primary
            await supabase
                .from('pharmacy_clinic_links')
                .insert({
                    clinic_id: clinicId,
                    pharmacy_id: pharmacyId,
                    status: 'active',
                    is_primary: true,
                });
        }
    } catch (linkErr) {
        console.warn('[pharmacyService] Could not upsert pharmacy_clinic_links row during link:', linkErr);
    }
}

export async function unlinkPharmacyFromClinic(clinicId: string, pharmacyId: string): Promise<void> {
    const { error: pharmacyError } = await supabase
        .from('pharmacies')
        .update({ clinic_id: null })
        .eq('id', pharmacyId)
        .eq('clinic_id', clinicId);

    if (pharmacyError) {
        console.warn('[pharmacyService] Could not update pharmacy directory row during unlink:', pharmacyError);
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({ clinic_id: null })
        .eq('id', pharmacyId);

    if (profileError) throw profileError;
}

export async function routePrescriptionToPharmacy(prescriptionId: string, pharmacyId: string | null): Promise<void> {
    const updatePayload = pharmacyId
        ? { pharmacy_id: pharmacyId, pharmacy_status: 'sent_to_pharmacy' }
        : { pharmacy_id: null as null, pharmacy_status: 'not_sent' };

    const { error } = await supabase
        .from('prescriptions')
        .update(updatePayload)
        .eq('id', prescriptionId);

    if (error) throw error;
}
