import React, { useMemo, useState } from 'react';
import { LOGO_CONFIG, type LogoTheme, type LogoUsage, type LogoVariant } from '../constants/logo';
import { useLogoUrls } from '../context/LogoContext';

export type LogoProps = {
  variant?: LogoVariant;
  theme?: LogoTheme;
  usage: LogoUsage;
  className?: string;
  onClick?: () => void;
};

const FallbackMark: React.FC<{
  width: number;
  height: number;
  className?: string;
}> = ({ width, height, className }) => (
  <div
    style={{ width, height }}
    className={`flex items-center justify-center rounded-xl bg-teal-500 text-white font-black text-lg select-none ${className ?? ''
      }`}
  >
    N
  </div>
);

const BaseLogo: React.FC<LogoProps> = ({
  variant = 'full',
  theme = 'dark',
  usage,
  className,
  onClick,
}) => {
  const logoUrls = useLogoUrls();
  const [errored, setErrored] = useState(false);

  const { src, width, height } = useMemo(() => {
    const size = LOGO_CONFIG.sizes[usage] ?? LOGO_CONFIG.sizes.navbar;

    let key: keyof typeof logoUrls;
    if (variant === 'icon') {
      key = theme === 'dark' ? 'iconWhite' : 'icon';
    } else {
      key = theme === 'dark' ? 'fullWhite' : 'full';
    }

    const resolvedSrc =
      logoUrls[key] ??
      (key === 'iconWhite'
        ? LOGO_CONFIG.iconWhite
        : key === 'icon'
          ? LOGO_CONFIG.icon
          : key === 'fullWhite'
            ? LOGO_CONFIG.fullWhite
            : LOGO_CONFIG.full);

    return {
      src: resolvedSrc,
      width: size.width,
      height: size.height,
    };
  }, [logoUrls, usage, variant, theme]);

  if (!src || errored) {
    return <FallbackMark width={width} height={height} className={className} />;
  }

  return (
    <img
      src={src}
      alt="NirogOS logo"
      width={width}
      height={height}
      onClick={onClick}
      onError={() => setErrored(true)}
      className={`select-none object-contain ${className ?? ''}`}
      loading="lazy"
    />
  );
};

export const Logo = React.memo(BaseLogo);

