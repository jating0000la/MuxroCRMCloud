import React, { useCallback, useState } from 'react';

interface LogoImageProps {
  src: string;
  alt: string;
  size?: number;
}

/** Renders a logo inside a size-adaptive container so wide/tall logos never look squished. */
export default function LogoImage({ src, alt, size = 64 }: LogoImageProps) {
  const [fitClass, setFitClass] = useState('object-contain');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ w, h });
    const ratio = w / h;
    if (ratio > 2) setFitClass('object-contain w-[80%]');
    else if (ratio > 1.3) setFitClass('object-contain w-[70%]');
    else if (ratio < 0.5) setFitClass('object-contain h-[80%]');
    else if (ratio < 0.75) setFitClass('object-contain h-[70%]');
    else setFitClass('object-contain');
  }, []);

  const containerStyle: React.CSSProperties = naturalSize
    ? (() => {
        const ratio = naturalSize.w / naturalSize.h;
        if (ratio > 1.8) return { width: size * 1.6, height: size * 0.7, borderRadius: 8 };
        if (ratio > 1.3) return { width: size * 1.3, height: size * 0.85, borderRadius: 8 };
        if (ratio < 0.55) return { width: size * 0.7, height: size * 1.3, borderRadius: 8 };
        if (ratio < 0.75) return { width: size * 0.85, height: size * 1.1, borderRadius: 8 };
        return { width: size, height: size, borderRadius: 8 };
      })()
    : { width: size, height: size, borderRadius: 8 };

  return (
    <div className="flex items-center justify-center overflow-hidden bg-white/20" style={containerStyle}>
      <img src={src} alt={alt} onLoad={handleLoad} className={`${fitClass} max-h-full`} />
    </div>
  );
}
