import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * ThemeToggle — snaps the <html> element between .light and .dark instantly.
 * Persists choice to localStorage under the key "theme".
 */
export default function ThemeToggle() {
    const [isDark, setIsDark] = useState<boolean>(false);
    const [mounted, setMounted] = useState(false);

    // On mount, read saved preference (or fall back to OS preference)
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            setIsDark(true);
        } else if (saved === 'light') {
            setIsDark(false);
        } else {
            // No saved pref — use OS default
            setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
    }, []);

    // Whenever isDark changes, hard-swap the html class
    useEffect(() => {
        if (!mounted) return;
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(isDark ? 'dark' : 'light');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark, mounted]);

    if (!mounted) return null;

    return (
        <button
            onClick={() => setIsDark(prev => !prev)}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={`
        relative flex items-center gap-2 px-3 py-2 rounded-xl border font-semibold text-xs
        transition-all duration-200 shadow-sm hover:scale-105 active:scale-95
        ${isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500/60 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-slate-50'
                }
      `}
        >
            {isDark ? (
                <>
                    <Sun size={14} className="text-amber-400" />
                    <span>Light</span>
                </>
            ) : (
                <>
                    <Moon size={14} className="text-indigo-500" />
                    <span>Dark</span>
                </>
            )}
        </button>
    );
}
