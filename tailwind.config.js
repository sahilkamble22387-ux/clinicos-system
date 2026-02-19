/** @type {import('tailwindcss').Config} */
export default {
    // Enable class-based dark mode — toggled by adding 'dark' class to root element
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        './**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            // ── Design Token Mappings ──
            // Maps CSS custom properties to Tailwind utility classes
            colors: {
                // User requested aliases
                background: 'var(--bg)',
                card: 'var(--card)',
                border: 'var(--border)',
                primary: 'var(--accent)',
                textPrimary: 'var(--text-primary)',
                textSecondary: 'var(--text-secondary)',

                // Existing/Legacy aliases for backward compatibility
                app: 'var(--bg)',
                sidebar: 'var(--sidebar)',
                accent: 'var(--accent)',
                'accent-hover': 'var(--accent-hover)',
            },
            backgroundColor: {
                skin: 'var(--bg)', // fallback
            },
            borderColor: {
                main: 'var(--border)', // keeping for existing code
            },
            textColor: {
                primary: 'var(--text-primary)',
                secondary: 'var(--text-secondary)',
                accent: 'var(--accent)',
            },
            boxShadow: {
                soft: 'var(--shadow-soft)',
            },
        },
    },
    plugins: [],
};
