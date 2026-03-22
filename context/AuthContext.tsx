import React, { createContext, useContext } from 'react';
import { ClinicProfile } from '../types/clinic';

interface AuthContextType {
    user: any;
    session: any;
    profile: any;
    clinicId: string | null;
    loading: boolean;
    clinicProfile: ClinicProfile | null;
    onboardingCompleted: boolean;
    refreshClinicProfile: () => Promise<void>;
}

// Safe defaults used when a component calls useAuth() outside the provider
// (e.g. LoginPage, PharmacyPortal). Prevents "must be used within AuthProvider" crash.
const AUTH_DEFAULTS: AuthContextType = {
    user: null,
    session: null,
    profile: null,
    clinicId: null,
    loading: true,
    clinicProfile: null,
    onboardingCompleted: false,
    refreshClinicProfile: async () => { },
};

export const AuthContext = createContext<AuthContextType>(AUTH_DEFAULTS);

export const AuthProvider: React.FC<{
    user: any;
    session: any;
    profile: any;
    clinicId: string | null;
    loading: boolean;
    clinicProfile: any;
    refreshClinicProfile: () => Promise<void>;
    children: React.ReactNode;
}> = ({ user, session, profile, clinicId, loading, clinicProfile, refreshClinicProfile, children }) => {
    const onboardingCompleted = clinicProfile?.onboarding_completed ?? false;
    return (
        <AuthContext.Provider value={{ user, session, profile, clinicId, loading, clinicProfile, onboardingCompleted, refreshClinicProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

// BUG FIX: No longer throws — returns safe defaults when outside provider.
// This prevents crashes on LoginPage, PharmacyPortal, and any other route
// that renders before the doctor app's AuthProvider is mounted.
export const useAuth = (): AuthContextType => {
    return useContext(AuthContext);
};