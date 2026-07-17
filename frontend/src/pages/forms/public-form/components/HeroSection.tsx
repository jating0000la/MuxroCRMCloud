import { ArrowDown } from 'lucide-react';
import LogoImage from './LogoImage';
import { TRUST_BADGES } from '../constants';

interface HeroSectionProps {
  logo: string;
  companyName: string;
  title: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  bannerImage: string;
  showScrollCta: boolean;
  formAnchorId: string;
}

/** Premium landing hero: gradient (or banner) background, logo, title, trust badges. */
export default function HeroSection({
  logo,
  companyName,
  title,
  description,
  primaryColor,
  secondaryColor,
  bannerImage,
  showScrollCta,
  formAnchorId,
}: HeroSectionProps) {
  const scrollToForm = () => {
    document.getElementById(formAnchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      className="relative px-4 py-16 sm:py-20 text-center overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
    >
      {bannerImage && (
        <div
          className="absolute inset-0 opacity-25 bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerImage})` }}
          aria-hidden="true"
        />
      )}
      <div className="relative max-w-3xl mx-auto">
        <div className="flex items-center justify-center mb-6">
          {logo ? (
            <LogoImage src={logo} alt={`${companyName} logo`} size={84} />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center shadow-lg backdrop-blur-sm">
              <span className="text-2xl font-bold text-white">{companyName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <p className="text-white/70 text-sm font-semibold tracking-wide uppercase mb-3">{companyName}</p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">{title}</h1>
        {description && <p className="text-white/85 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8">{description}</p>}

        <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
          {TRUST_BADGES.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white/90 bg-white/10 border border-white/20 rounded-full px-3.5 py-1.5 backdrop-blur-sm"
            >
              {item}
            </span>
          ))}
        </div>

        {showScrollCta && (
          <button
            type="button"
            onClick={scrollToForm}
            className="mt-8 inline-flex items-center gap-2 bg-white text-gray-900 font-semibold text-sm px-6 py-3 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Fill the Form
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </button>
        )}
      </div>
    </section>
  );
}
