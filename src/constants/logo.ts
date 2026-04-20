export const LOGO_CONFIG = {
  // This is the ONLY block people should ever edit for paths/sizes.
  // Naming follows current app usage:
  // `icon` / `full` are used on darker surfaces.
  // `iconWhite` / `fullWhite` are used on lighter surfaces.
  icon: '/assets/logo/nirogos-mark-dark.svg',
  iconWhite: '/assets/logo/nirogos-mark-light.svg',
  full: '/assets/logo/nirogos-lockup-dark.svg',
  fullWhite: '/assets/logo/nirogos-lockup-light.svg',

  sizes: {
    favicon: { width: 32, height: 32 },
    appLoader: { width: 144, height: 144 },
    sidebarIcon: { width: 32, height: 32 },
    sidebarExpanded: { width: 176, height: 56 },
    navbar: { width: 152, height: 44 },
    loginPage: { width: 64, height: 64 },
    appleTouch: { width: 180, height: 180 },
    pwa: { width: 192, height: 192 },
  },
} as const;

export type LogoVariant = 'icon' | 'full';
export type LogoTheme = 'dark' | 'light';
export type LogoUsage = keyof typeof LOGO_CONFIG.sizes;

export type LogoConfig = typeof LOGO_CONFIG;
