import { supabase } from './db';

export interface PharmacyDirectoryItem {
    id: string;
    clinic_id: string | null;
    owner_name: string | null;
    name: string;
    license_number: string | null;
    phone: string | null;
    email: string | null;
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
}

export interface DoctorPharmacyNetwork {
    linkedPharmacies: PharmacyDirectoryItem[];
    directoryPharmacies: PharmacyDirectoryItem[];
    defaultPharmacyId: string | null;
}

function defaultPharmacyKey(clinicId: string) {
    return `clinic:${clinicId}:default_pharmacy_id`;
}

export async function ensurePharmacyFromMetadata(): Promise<void> {
    const { error } = await (supabase as any).rpc('ensure_pharmacy_from_metadata');
    if (error) {
        throw error;
    }
}

export async function fetchProfileRole(userId: string): Promise<PharmacyProfileRow | null> {
    const { data, error } = await (supabase as any)
        .from('profiles')
        .select('role, pharmacy_id, clinic_id')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return (data as PharmacyProfileRow | null) ?? null;
}

export async function syncAndFetchPharmacyProfile(userId: string): Promise<PharmacyProfileRow | null> {
    try {
        await ensurePharmacyFromMetadata();
    } catch (error: any) {
        const message = String(error?.message ?? '');
        if (!message.toLowerCase().includes('ensure_pharmacy_from_metadata')) {
            throw error;
        }
    }

    return fetchProfileRole(userId);
}

export async function fetchDoctorPharmacyNetwork(clinicId: string): Promise<DoctorPharmacyNetwork> {
    const { data: pharmacies, error: pharmaciesError } = await (supabase as any)
        .from('pharmacies')
        .select('id, clinic_id, owner_name, name, license_number, phone, email, address, city, pincode, is_verified, created_at')
        .order('created_at', { ascending: false });

    if (pharmaciesError) throw pharmaciesError;

    const all = (pharmacies ?? []) as PharmacyDirectoryItem[];
    const linkedPharmacies = all
        .filter(pharmacy => pharmacy.clinic_id === clinicId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const directoryPharmacies = all
        .sort((a, b) => {
            if (a.clinic_id === clinicId && b.clinic_id !== clinicId) return -1;
            if (!a.clinic_id && b.clinic_id) return -1;
            if (a.clinic_id && !b.clinic_id) return 1;
            if (a.clinic_id !== clinicId && b.clinic_id === clinicId) return 1;
            return a.name.localeCompare(b.name);
        });

    const { data: defaultSetting, error: defaultError } = await (supabase as any)
        .from('clinic_settings')
        .select('value')
        .eq('key', defaultPharmacyKey(clinicId))
        .maybeSingle();

    if (defaultError) throw defaultError;

    const savedDefault = typeof defaultSetting?.value === 'string' ? defaultSetting.value : null;
    const defaultPharmacyId = linkedPharmacies.some(pharmacy => pharmacy.id === savedDefault)
        ? savedDefault
        : linkedPharmacies[0]?.id ?? null;

    return { linkedPharmacies, directoryPharmacies, defaultPharmacyId };
}

export async function setClinicDefaultPharmacy(clinicId: string, pharmacyId: string): Promise<void> {
    const { error } = await (supabase as any)
        .from('clinic_settings')
        .upsert({
            key: defaultPharmacyKey(clinicId),
            value: pharmacyId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

    if (error) throw error;
}

export async function clearClinicDefaultPharmacy(clinicId: string): Promise<void> {
    const { error } = await (supabase as any)
        .from('clinic_settings')
        .delete()
        .eq('key', defaultPharmacyKey(clinicId));

    if (error) throw error;
}

export async function linkPharmacyToClinic(clinicId: string, pharmacyId: string): Promise<void> {
    const { error: pharmacyError } = await (supabase as any)
        .from('pharmacies')
        .update({ clinic_id: clinicId })
        .eq('id', pharmacyId);

    if (pharmacyError) throw pharmacyError;

    const { error: profileError } = await (supabase as any)
        .from('profiles')
        .upsert([{
            id: pharmacyId,
            role: 'pharmacy_staff',
            pharmacy_id: pharmacyId,
            clinic_id: clinicId,
        }], { onConflict: 'id' });

    if (profileError) throw profileError;
}

export async function unlinkPharmacyFromClinic(clinicId: string, pharmacyId: string): Promise<void> {
    const { error: pharmacyError } = await (supabase as any)
        .from('pharmacies')
        .update({ clinic_id: null })
        .eq('id', pharmacyId)
        .eq('clinic_id', clinicId);

    if (pharmacyError) throw pharmacyError;

    const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({ clinic_id: null })
        .eq('id', pharmacyId);

    if (profileError) throw profileError;
}

export async function routePrescriptionToPharmacy(prescriptionId: string, pharmacyId: string | null): Promise<void> {
    const updatePayload = pharmacyId
        ? { pharmacy_id: pharmacyId, pharmacy_status: 'sent_to_pharmacy' }
        : { pharmacy_id: null, pharmacy_status: 'not_sent' };

    const { error } = await (supabase as any)
        .from('prescriptions')
        .update(updatePayload)
        .eq('id', prescriptionId);

    if (error) throw error;
}
