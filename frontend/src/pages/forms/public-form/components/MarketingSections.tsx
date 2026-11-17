import { CheckCircle2 } from 'lucide-react';
import { ServiceItem } from '../types';

interface SectionHeadingProps {
  title: string;
  primaryColor: string;
}

function SectionHeading({ title, primaryColor }: SectionHeadingProps) {
  return (
    <div className="text-center mb-7">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="w-14 h-1 rounded mx-auto" style={{ backgroundColor: primaryColor }} />
    </div>
  );
}

interface AboutSectionProps {
  title: string;
  text: string;
  primaryColor: string;
  cardRadius: string;
}

export function AboutSection({ title, text, primaryColor, cardRadius }: AboutSectionProps) {
  if (!text) return null;
  return (
    <section className="px-4 py-4 animate-fade-up">
      <div className="max-w-4xl mx-auto p-8 text-center shadow-sm" style={{ backgroundColor: `${primaryColor}08`, borderRadius: cardRadius }}>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h2>
        <div className="w-14 h-1 rounded mx-auto mb-5" style={{ backgroundColor: primaryColor }} />
        <p className="text-gray-600 text-base leading-relaxed max-w-2xl mx-auto whitespace-pre-line">{text}</p>
      </div>
    </section>
  );
}

interface ServicesSectionProps {
  title: string;
  services: ServiceItem[];
  primaryColor: string;
  cardRadius: string;
}

export function ServicesSection({ title, services, primaryColor, cardRadius }: ServicesSectionProps) {
  if (!services?.length) return null;
  return (
    <section className="px-4 py-4 animate-fade-up">
      <div className="max-w-5xl mx-auto bg-white/40 backdrop-blur-sm rounded-2xl shadow-sm p-6 sm:p-8">
        <SectionHeading title={title} primaryColor={primaryColor} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, i) => (
            <div key={svc.title || i} className="p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white/40 backdrop-blur-sm" style={{ borderRadius: cardRadius }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}18` }}>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>{String.fromCharCode(65 + (i % 26))}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{svc.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{svc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface WhyUsSectionProps {
  title: string;
  points: string[];
  primaryColor: string;
  secondaryColor: string;
}

export function WhyUsSection({ title, points, primaryColor, secondaryColor }: WhyUsSectionProps) {
  const filtered = points?.filter(Boolean) || [];
  if (!filtered.length) return null;
  return (
    <section className="px-4 py-4 animate-fade-up">
      <div className="max-w-4xl mx-auto rounded-2xl p-8 shadow-sm" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${secondaryColor}08)` }}>
        <SectionHeading title={title} primaryColor={primaryColor} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((pt, i) => (
            <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${primaryColor}20` }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <p className="text-gray-700 font-medium">{pt}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface GallerySectionProps {
  images: string[];
  primaryColor: string;
  cardRadius: string;
}

export function GallerySection({ images, primaryColor, cardRadius }: GallerySectionProps) {
  const filtered = images?.filter(Boolean) || [];
  if (!filtered.length) return null;
  return (
    <section className="px-4 py-4 animate-fade-up">
      <div className="max-w-5xl mx-auto rounded-2xl shadow-sm p-6 sm:p-8 bg-white/40 backdrop-blur-sm">
        <SectionHeading title="Gallery" primaryColor={primaryColor} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((img, i) => (
            <div key={img + i} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: cardRadius, aspectRatio: '4/3' }}>
              <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
