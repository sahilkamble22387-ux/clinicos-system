import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, User, Bell, Shield, HelpCircle, ExternalLink, ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '../services/db'

export default function Settings() {
    const [session, setSession] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setLoading(false)
        })
    }, [])

    const profile = session?.user?.user_metadata
    const fullName = profile?.full_name || profile?.first_name || session?.user?.email?.split('@')[0] || 'Doctor'
    const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const sections = [
        {
            title: 'Account',
            items: [
                {
                    icon: User,
                    label: 'Profile Information',
                    sub: fullName,
                    action: () => { },
                    color: 'bg-indigo-100 text-indigo-600',
                },
                {
                    icon: Bell,
                    label: 'Notifications',
                    sub: 'Manage alerts and reminders',
                    action: () => { },
                    color: 'bg-amber-100 text-amber-600',
                },
                {
                    icon: Shield,
                    label: 'Security',
                    sub: 'Password and authentication',
                    action: () => { },
                    color: 'bg-emerald-100 text-emerald-600',
                },
            ],
        },
        {
            title: 'Support',
            items: [
                {
                    icon: HelpCircle,
                    label: 'Help & Documentation',
                    sub: 'FAQs and guides',
                    action: () => window.open('https://wa.me/919876543210', '_blank'),
                    color: 'bg-blue-100 text-blue-600',
                },
                {
                    icon: ExternalLink,
                    label: 'Privacy Policy',
                    sub: 'How we handle your data',
                    action: () => { window.location.href = '/privacy' },
                    color: 'bg-slate-100 text-slate-600',
                },
                {
                    icon: ExternalLink,
                    label: 'Terms of Service',
                    sub: 'Usage terms and conditions',
                    action: () => { window.location.href = '/terms' },
                    color: 'bg-slate-100 text-slate-600',
                },
            ],
        },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
            {/* Header */}
            <div
                className="sticky top-0 bg-white border-b border-slate-100 z-10"
                style={{ paddingTop: 'var(--sat)' }}
            >
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => window.history.back()}
                        className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center active:bg-slate-200 transition"
                    >
                        <ArrowLeft size={16} className="text-slate-600" />
                    </button>
                    <h1 className="font-black text-slate-900 text-lg">Settings</h1>
                </div>
            </div>

            {/* Profile card */}
            <div className="px-4 pt-5">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-500/25">
                        {initials}
                    </div>
                    <div>
                        <p className="font-black text-slate-900 text-base">{fullName}</p>
                        <p className="text-slate-400 text-xs mt-0.5">ClinicOS Admin</p>
                    </div>
                </div>
            </div>

            {/* Settings sections */}
            <div className="px-4 space-y-5">
                {sections.map(section => (
                    <div key={section.title}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                            {section.title}
                        </p>
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            {section.items.map((item, i) => (
                                <button
                                    key={item.label}
                                    onClick={item.action}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition text-left ${i < section.items.length - 1 ? 'border-b border-slate-50' : ''
                                        }`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                                        <item.icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                                        <p className="text-slate-400 text-xs mt-0.5 truncate">{item.sub}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Danger zone */}
                <div>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 px-1">
                        Account
                    </p>
                    <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-4 active:bg-red-50 transition"
                        >
                            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                <LogOut size={16} className="text-red-600" />
                            </div>
                            <span className="font-bold text-red-600 text-sm">Sign Out</span>
                        </button>
                    </div>
                </div>

                <p className="text-center text-slate-300 text-xs pb-4">
                    ClinicOS v1.0 · © 2026
                </p>
            </div>
        </div>
    )
}
