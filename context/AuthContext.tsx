import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/db';
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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
    user: any;
    session: any;
    profile: any;
    clinicId: string | null;
    loading: boolean;
    clinicProfile: any;
    refreshClinicProfile: () => Promise<void>;
    children: React.ReactNode;
}> = ({
    user,
    session,
    profile,
    clinicId,
    loading,
    clinicProfile,
    refreshClinicProfile,
    children
}) => {
        const onboardingCompleted = clinicProfile?.onboarding_completed ?? false;

        return (
            <AuthContext.Provider
                value={{
                    user,
                    session,
                    profile,
                    clinicId,
                    loading,
                    clinicProfile,
                    onboardingCompleted,
                    refreshClinicProfile,
                }}
            >
                {children}
            </AuthContext.Provider>
        );
    };

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
