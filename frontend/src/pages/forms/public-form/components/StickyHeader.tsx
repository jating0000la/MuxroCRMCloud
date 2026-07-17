import LogoImage from './LogoImage';

interface StickyHeaderProps {
  logo: string;
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  showProgress: boolean;
  progress: number;
}

/** Slim enterprise header (logo + company name) with an attached sticky progress bar. */
export default function StickyHeader({
  logo,
  companyName,
  primaryColor,
  secondaryColor,
  showProgress,
  progress,
}: StickyHeaderProps) {
  return (
    <header className="sticky top-0 z-40 shadow-md">
      <div className="w-full py-3 px-5" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          {logo ? (
            <LogoImage src={logo} alt="Logo" size={44} />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-white">{companyName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="text-base sm:text-lg font-bold text-white truncate">{companyName}</span>
        </div>
      </div>
      {showProgress && (
        <div className="w-full bg-white/95 backdrop-blur-sm px-5 py-1.5">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%`, backgroundColor: primaryColor }}
              />
            </div>
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: primaryColor }}>
              {progress}% complete
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
