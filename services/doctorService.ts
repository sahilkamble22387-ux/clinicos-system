import { Clinic } from '../types';
import { supabase } from './db';

function buildDoctorIdentity(user: {
    id?: string;
    email?: string;
    user_metadata?: {
        first_name?: string;
        last_name?: string;
        full_name?: string;
    };
}) {
    const meta = user?.user_metadata ?? {};
    const firstName =
        meta.first_name?.trim() ||
        meta.full_name?.split(' ')[0]?.trim() ||
        user?.email?.split('@')[0]?.trim() ||
        'Doctor';
    const lastName = meta.last_name?.trim() ?? '';
    const derivedName = lastName ? `${firstName} ${lastName}` : firstName;

    return {
        derivedName,
        personalClinicName: `Dr. ${firstName}'s Clinic`,
    };
}

async function fetchClinicByUser(userId: string): Promise<Clinic | null> {
    const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .or(`owner_id.eq.${userId},id.eq.${userId}`)
        .limit(1);

    if (error) throw error;
    return (data?.[0] as Clinic | undefined) ?? null;
}

async function syncDoctorProfile(userId: string, clinicId: string, fullName: string) {
    const { error } = await supabase
        .from('profiles')
        .upsert([{
            id: userId,
            clinic_id: clinicId,
            role: 'doctor',
            full_name: fullName,
        }], { onConflict: 'id' });

    if (error) throw error;
}

async function renameLegacyClinic(clinic: Clinic, targetName: string): Promise<Clinic> {
    if (clinic.name !== 'My Clinic') return clinic;

    const { error } = await supabase
        .from('clinics')
        .update({ name: targetName })
        .eq('id', clinic.id);

    if (error) throw error;
    return { ...clinic, name: targetName };
}

export interface DoctorBootstrapResult {
    clinic: Clinic | null;
    role: string | null;
}

export async function ensureDoctorClinicSetup(user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
}): Promise<DoctorBootstrapResult> {
    if (!user?.id) {
        return { clinic: null, role: null };
    }

    const { derivedName, personalClinicName } = buildDoctorIdentity(user);

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('clinic_id, role')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (profile?.role === 'pharmacy_staff') {
        return { clinic: null, role: 'pharmacy_staff' };
    }

    if (profile?.clinic_id) {
        const { data: clinicData, error: clinicError } = await supabase
            .from('clinics')
            .select('*')
            .eq('id', profile.clinic_id)
            .maybeSingle();

        if (clinicError) throw clinicError;

        if (clinicData) {
            const hydratedClinic = await renameLegacyClinic(clinicData as Clinic, personalClinicName);
            await syncDoctorProfile(user.id, hydratedClinic.id, derivedName);
            return { clinic: hydratedClinic, role: profile?.role ?? 'doctor' };
        }
    }

    const existingClinic = await fetchClinicByUser(user.id);
    if (existingClinic) {
        const hydratedClinic = await renameLegacyClinic(existingClinic, personalClinicName);
        await syncDoctorProfile(user.id, hydratedClinic.id, derivedName);
        return { clinic: hydratedClinic, role: profile?.role ?? 'doctor' };
    }

    const { data: createdClinic, error: createError } = await supabase
        .from('clinics')
        .insert([{ id: user.id, name: personalClinicName, owner_id: user.id }])
        .select()
        .single();

    if (createError) {
        const fallbackClinic = await fetchClinicByUser(user.id);
        if (!fallbackClinic) throw createError;

        const hydratedClinic = await renameLegacyClinic(fallbackClinic, personalClinicName);
        await syncDoctorProfile(user.id, hydratedClinic.id, derivedName);
        return { clinic: hydratedClinic, role: 'doctor' };
    }

    await syncDoctorProfile(user.id, createdClinic.id, derivedName);
    return { clinic: createdClinic as Clinic, role: 'doctor' };
}
