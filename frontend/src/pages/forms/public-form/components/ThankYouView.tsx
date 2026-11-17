import { CheckCircle2, Mail, Phone } from 'lucide-react';
import { PageConfig } from '../types';
import { BORDER_RADIUS_MAP, FONT_FAMILY_MAP } from '../constants';
import { isSafeRedirectUrl } from '../utils';

interface ThankYouViewProps {
  pageConfig: PageConfig;
  companyName: string;
  onReset: () => void;
}

export default function ThankYouView({ pageConfig, companyName, onReset }: ThankYouViewProps) {
  const primaryColor = pageConfig.primaryColor || '#0ea5e9';
  const cardRadius = BORDER_RADIUS_MAP[pageConfig.borderRadius] || '12px';
  const btnRadius = pageConfig.borderRadius === 'full' ? '9999px' : BORDER_RADIUS_MAP[pageConfig.borderRadius] || '12px';
  const hasRedirect = pageConfig.thankYouRedirectUrl && isSafeRedirectUrl(pageConfig.thankYouRedirectUrl);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: pageConfig.backgroundImage ? `url(${pageConfig.backgroundImage}) center/cover fixed` : pageConfig.backgroundColor,
        fontFamily: FONT_FAMILY_MAP[pageConfig.fontFamily] || FONT_FAMILY_MAP.system,
      }}
    >
      <div className="max-w-lg w-full text-center animate-fade-up">
        <div className="bg-white shadow-2xl p-10" style={{ borderRadius: cardRadius }}>
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: primaryColor }} />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
              <CheckCircle2 className="w-12 h-12" style={{ color: primaryColor }} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{pageConfig.thankYouTitle || 'Thank You!'}</h1>
          <p className="text-gray-500 text-lg mb-6 leading-relaxed">
            {pageConfig.thankYouMessage || 'Your submission has been received. We will get back to you shortly.'}
          </p>

          {(pageConfig.thankYouPhone || pageConfig.thankYouEmail) && (
            <div className="mb-6 p-4 rounded-2xl" style={{ backgroundColor: `${primaryColor}10` }}>
              <p className="text-sm font-semibold text-gray-700 mb-3">Contact Us</p>
              {pageConfig.thankYouPhone && (
                <a href={`tel:${pageConfig.thankYouPhone}`} className="flex items-center justify-center gap-2 text-gray-700 hover:underline mb-2">
                  <Phone className="w-4 h-4" />
                  {pageConfig.thankYouPhone}
                </a>
              )}
              {pageConfig.thankYouEmail && (
                <a href={`mailto:${pageConfig.thankYouEmail}`} className="flex items-center justify-center gap-2 text-gray-700 hover:underline">
                  <Mail className="w-4 h-4" />
                  {pageConfig.thankYouEmail}
                </a>
              )}
            </div>
          )}

          {hasRedirect && <p className="text-xs text-gray-400 mb-4">Redirecting you in a moment...</p>}

          <button
            type="button"
            onClick={onReset}
            className="px-8 py-3 font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor, borderRadius: btnRadius }}
          >
            Submit Another Response
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">{pageConfig.footerText || `© ${new Date().getFullYear()} ${companyName}`}</p>
      </div>
    </div>
  );
}
