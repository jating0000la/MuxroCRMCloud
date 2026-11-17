import { ReactNode } from 'react';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { PageConfig } from '../types';
import { getEmbeddableMapUrl } from '../utils';

interface ContactMapSectionProps {
  pageConfig: PageConfig;
  primaryColor: string;
  cardRadius: string;
}

export default function ContactMapSection({ pageConfig, primaryColor, cardRadius }: ContactMapSectionProps) {
  const showMapPanel = pageConfig.showMap && !!pageConfig.mapEmbedUrl;
  const embeddableMapUrl = showMapPanel ? getEmbeddableMapUrl(pageConfig.mapEmbedUrl) : null;
  if (!pageConfig.showContact && !showMapPanel) return null;

  return (
    <section className="px-4 py-4 animate-fade-up">
      <div className="max-w-5xl mx-auto rounded-2xl shadow-sm p-6 sm:p-8" style={{ backgroundColor: `${primaryColor}06` }}>
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Contact Information</h2>
          <div className="w-14 h-1 rounded mx-auto" style={{ backgroundColor: primaryColor }} />
        </div>
        <div className={`grid gap-6 ${showMapPanel ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
          {pageConfig.showContact && (
            <div className="bg-white/40 backdrop-blur-sm p-6 shadow-sm" style={{ borderRadius: cardRadius }}>
              <h3 className="text-lg font-bold text-gray-900 mb-5">Get in Touch</h3>
              <div className="space-y-4">
                {pageConfig.contactPhone && (
                  <ContactRow icon={<Phone className="w-5 h-5" style={{ color: primaryColor }} />} label="Phone" value={pageConfig.contactPhone} href={`tel:${pageConfig.contactPhone}`} primaryColor={primaryColor} />
                )}
                {pageConfig.contactEmail && (
                  <ContactRow icon={<Mail className="w-5 h-5" style={{ color: primaryColor }} />} label="Email" value={pageConfig.contactEmail} href={`mailto:${pageConfig.contactEmail}`} primaryColor={primaryColor} />
                )}
                {pageConfig.contactAddress && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${primaryColor}15` }}>
                      <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Address</p>
                      <p className="text-gray-800 font-semibold leading-relaxed">{pageConfig.contactAddress}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {showMapPanel && (
            <div className="overflow-hidden shadow-sm" style={{ borderRadius: cardRadius, height: 300 }}>
              {embeddableMapUrl ? (
                <iframe
                  src={embeddableMapUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Location Map"
                />
              ) : (
                <a
                  href={pageConfig.mapEmbedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-50 hover:bg-gray-100 transition-colors text-center p-6"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                    <MapPin className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">View Location on Google Maps</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: primaryColor }}>
                    Open map
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface ContactRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
  primaryColor: string;
}

function ContactRow({ icon, label, value, href, primaryColor }: ContactRowProps) {
  return (
    <a href={href} className="flex items-center gap-4 group">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-gray-800 font-semibold group-hover:underline">{value}</p>
      </div>
    </a>
  );
}
