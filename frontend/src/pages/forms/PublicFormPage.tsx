import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { formService } from '../../services/forms';
import { Form, FormField } from '../../types';
import { readBranding } from '../../utils/branding';
import toast from 'react-hot-toast';

// Only allow navigating to http(s) URLs or same-origin relative paths.
// Prevents a stored javascript:/data: URI (from form page config) from
// executing when a public visitor's browser performs the redirect.
function isSafeRedirectUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormDesign {
  layout: 'centered' | 'split';
  buttonStyle: 'solid' | 'gradient' | 'outline';
  showProgress: boolean;
  customColor: string;
  theme?: string;
  radius?: string;
}

interface PageConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  backgroundImage: string;
  fontFamily: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  companyLogo: string;
  bannerImage: string;
  showAbout: boolean;
  aboutTitle: string;
  aboutText: string;
  showServices: boolean;
  servicesTitle: string;
  services: Array<{ title: string; description: string }>;
  showWhyUs: boolean;
  whyUsTitle: string;
  whyUsPoints: string[];
  showGallery: boolean;
  galleryImages: string[];
  showContact: boolean;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  showMap: boolean;
  mapEmbedUrl: string;
  companyName: string;
  footerText: string;
  privacyUrl: string;
  termsUrl: string;
  thankYouTitle: string;
  thankYouMessage: string;
  thankYouPhone: string;
  thankYouEmail: string;
  thankYouRedirectUrl: string;
  showWhatsapp: boolean;
  whatsappNumber: string;
  showCall: boolean;
  callNumber: string;
  showEmail: boolean;
  contactEmailBtn: string;
  metaTitle: string;
  metaDescription: string;
  faviconUrl: string;
}

const DEFAULT_FORM_DESIGN: FormDesign = {
  layout: 'centered',
  buttonStyle: 'gradient',
  showProgress: true,
  customColor: '#0ea5e9',
};

const DEFAULT_PAGE_CONFIG: PageConfig = {
  primaryColor: '#0ea5e9',
  secondaryColor: '#6366f1',
  backgroundColor: '#f8fafc',
  backgroundImage: '',
  fontFamily: 'system',
  borderRadius: 'md',
  companyLogo: '',
  bannerImage: '',
  showAbout: false,
  aboutTitle: 'About Us',
  aboutText: '',
  showServices: false,
  servicesTitle: 'Our Services',
  services: [],
  showWhyUs: false,
  whyUsTitle: 'Why Choose Us',
  whyUsPoints: [],
  showGallery: false,
  galleryImages: [],
  showContact: false,
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  showMap: false,
  mapEmbedUrl: '',
  companyName: '',
  footerText: '',
  privacyUrl: '',
  termsUrl: '',
  thankYouTitle: 'Thank You!',
  thankYouMessage: 'Your submission has been received. We will get back to you shortly.',
  thankYouPhone: '',
  thankYouEmail: '',
  thankYouRedirectUrl: '',
  showWhatsapp: false,
  whatsappNumber: '',
  showCall: false,
  callNumber: '',
  showEmail: false,
  contactEmailBtn: '',
  metaTitle: '',
  metaDescription: '',
  faviconUrl: '',
};

const FONT_FAMILY_MAP: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  playfair: '"Playfair Display", serif',
  poppins: '"Poppins", sans-serif',
  montserrat: '"Montserrat", sans-serif',
  lato: '"Lato", sans-serif',
  opensans: '"Open Sans", sans-serif',
};

const GOOGLE_FONTS: Record<string, string> = {
  inter: 'Inter:wght@300;400;500;600;700',
  roboto: 'Roboto:wght@300;400;500;700',
  playfair: 'Playfair+Display:wght@400;500;600;700',
  poppins: 'Poppins:wght@300;400;500;600;700',
  montserrat: 'Montserrat:wght@300;400;500;600;700',
  lato: 'Lato:wght@300;400;700',
  opensans: 'Open+Sans:wght@300;400;500;600;700',
};

const extractPublicFormConfig = (allFields: FormField[]) => {
  const metaField = allFields.find((f) => f.type === '__design_meta' || f.name === '__form_meta') as any;
  const fields = allFields.filter((f) => f.type !== '__design_meta' && f.name !== '__form_meta');
  const design: FormDesign = { ...DEFAULT_FORM_DESIGN, ...(metaField?.meta?.design || {}) };
  const pageConfig: PageConfig = { ...DEFAULT_PAGE_CONFIG, ...(metaField?.meta?.pageConfig || {}) };
  const description: string = metaField?.meta?.description || '';
  return { fields, design, description, pageConfig };
};

const LogoImage = ({ src, alt, size = 48 }: { src: string; alt: string; size?: number }) => {
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
    <div
      className="flex items-center justify-center overflow-hidden bg-white/20"
      style={containerStyle}
    >
      <img src={src} alt={alt} onLoad={handleLoad} className={`${fitClass} max-h-full`} />
    </div>
  );
};

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const branding = readBranding();

  useEffect(() => {
    loadForm();
  }, [slug]);

  // SEO & font injection
  useEffect(() => {
    if (!form) return;
    const { pageConfig } = extractPublicFormConfig((form.fields as FormField[]) || []);
    const pageTitle = pageConfig.metaTitle || form.title || branding.appName;
    document.title = pageTitle;
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    if (pageConfig.metaDescription) setMeta('description', pageConfig.metaDescription);
    if (pageConfig.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = pageConfig.faviconUrl;
    }
    if (pageConfig.fontFamily && pageConfig.fontFamily !== 'system' && GOOGLE_FONTS[pageConfig.fontFamily]) {
      const fontId = `gfont-${pageConfig.fontFamily}`;
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[pageConfig.fontFamily]}&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [form]);

  const loadForm = async () => {
    try {
      const data = await formService.getPublicForm(slug!);
      setForm(data);
    } catch (err) {
      setError('Form not found or no longer available');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fields = extractPublicFormConfig((form?.fields as FormField[]) || []).fields;

    fields.forEach((field) => {
      const value = formData[field.name];
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.name] = `${field.label ?? 'This field'} is required`;
      }
      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.name] = 'Please enter a valid email address';
      }
      if (value && field.type === 'phone' && !/^[\d\s\-+()]*$/.test(value)) {
        newErrors[field.name] = 'Please enter a valid phone number';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await formService.submitPublicForm(slug!, formData);
      setSubmitted(true);
      const { pageConfig } = extractPublicFormConfig((form?.fields as FormField[]) || []);
      if (pageConfig.thankYouRedirectUrl && isSafeRedirectUrl(pageConfig.thankYouRedirectUrl)) {
        setTimeout(() => { window.location.href = pageConfig.thankYouRedirectUrl; }, 3000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Available</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const { pageConfig } = extractPublicFormConfig((form?.fields as FormField[]) || []);
    const displayCompanyName2 = pageConfig.companyName || branding.appName;
    const primaryColor2 = pageConfig.primaryColor || '#0ea5e9';
    const BR_MAP2: Record<string, string> = { none: '0px', sm: '8px', md: '12px', lg: '16px', full: '9999px' };
    const cardR2 = BR_MAP2[pageConfig.borderRadius] || '12px';
    const btnR2 = pageConfig.borderRadius === 'full' ? '9999px' : BR_MAP2[pageConfig.borderRadius] || '12px';
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: pageConfig.backgroundImage ? `url(${pageConfig.backgroundImage}) center/cover fixed` : pageConfig.backgroundColor, fontFamily: FONT_FAMILY_MAP[pageConfig.fontFamily] || FONT_FAMILY_MAP.system }}>
        <div className="max-w-lg w-full text-center">
          <div className="bg-white shadow-2xl p-10" style={{ borderRadius: cardR2 }}>
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: primaryColor2 }} />
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor2}20` }}>
                <svg className="w-12 h-12" fill="none" stroke={primaryColor2} strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{pageConfig.thankYouTitle || 'Thank You!'}</h1>
            <p className="text-gray-500 text-lg mb-6 leading-relaxed">{pageConfig.thankYouMessage || 'Your submission has been received. We will get back to you shortly.'}</p>
            {(pageConfig.thankYouPhone || pageConfig.thankYouEmail) && (
              <div className="mb-6 p-4 rounded-2xl" style={{ backgroundColor: `${primaryColor2}10` }}>
                <p className="text-sm font-semibold text-gray-700 mb-3">Contact Us</p>
                {pageConfig.thankYouPhone && (
                  <a href={`tel:${pageConfig.thankYouPhone}`} className="flex items-center justify-center gap-2 text-gray-700 hover:underline mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {pageConfig.thankYouPhone}
                  </a>
                )}
                {pageConfig.thankYouEmail && (
                  <a href={`mailto:${pageConfig.thankYouEmail}`} className="flex items-center justify-center gap-2 text-gray-700 hover:underline">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {pageConfig.thankYouEmail}
                  </a>
                )}
              </div>
            )}
            {pageConfig.thankYouRedirectUrl && isSafeRedirectUrl(pageConfig.thankYouRedirectUrl) && <p className="text-xs text-gray-400 mb-4">Redirecting you in a moment...</p>}
            <button onClick={() => { setSubmitted(false); setFormData({}); }} className="px-8 py-3 font-semibold text-white rounded-xl transition-opacity hover:opacity-90" style={{ backgroundColor: primaryColor2, borderRadius: btnR2 }}>
              Submit Another Response
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">{pageConfig.footerText || `© ${new Date().getFullYear()} ${displayCompanyName2}`}</p>
        </div>
      </div>
    );
  }

  const { fields, design, description, pageConfig } = extractPublicFormConfig((form?.fields as FormField[]) || []);

  const displayLogo = pageConfig.companyLogo || branding.appLogoUrl;
  const displayCompanyName = pageConfig.companyName || branding.appName;

  const progress = fields.length > 0
    ? Math.round((Object.keys(formData).filter((k) => formData[k] && formData[k].toString().trim() !== '').length / fields.length) * 100)
    : 0;

  const BR_MAP: Record<string, string> = { none: '0px', sm: '8px', md: '12px', lg: '16px', full: '9999px' };
  const cardRadius = BR_MAP[pageConfig.borderRadius] || '12px';
  const btnRadius = pageConfig.borderRadius === 'full' ? '9999px' : BR_MAP[pageConfig.borderRadius] || '12px';
  const primaryColor = pageConfig.primaryColor !== DEFAULT_PAGE_CONFIG.primaryColor
    ? pageConfig.primaryColor
    : (design.customColor || DEFAULT_PAGE_CONFIG.primaryColor);
  const themeVars: React.CSSProperties = { fontFamily: FONT_FAMILY_MAP[pageConfig.fontFamily] || FONT_FAMILY_MAP.system };
  const pageBg: React.CSSProperties = pageConfig.backgroundImage
    ? { backgroundImage: `url(${pageConfig.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : { backgroundColor: pageConfig.backgroundColor };
  const hasAnySections = pageConfig.showAbout || pageConfig.showServices || pageConfig.showWhyUs
    || pageConfig.showGallery;

  const getFieldIcon = (fieldName: string, fieldType: string) => {
    const n = fieldName.toLowerCase();
    if (n.includes('name')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
    if (n.includes('email')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
    if (n.includes('phone') || n.includes('mobile')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>;
    if (n.includes('city') || n.includes('address')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>;
    if (n.includes('message') || n.includes('note') || fieldType === 'textarea') return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>;
    if (fieldType === 'date') return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
    return null;
  };

  const renderField = (field: FormField) => {
    const hasError = !!errors[field.name];
    const base = `w-full border transition-all duration-200 outline-none text-gray-800 text-sm ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`;
    const ir = 'rounded-xl';
    const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (!hasError) { e.target.style.borderColor = primaryColor; e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`; }
    };
    const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.target.style.borderColor = ''; e.target.style.boxShadow = '';
    };
    switch (field.type) {
      case 'textarea': {
        const filled = !!formData[field.name];
        return (
          <div className="relative">
            <textarea value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className={`${base} ${ir} px-4 pt-6 pb-3 resize-none`} rows={4} placeholder=" " id={`pf-${field.name}`} onFocus={onFocus as any} onBlur={onBlur as any} />
            <label htmlFor={`pf-${field.name}`} className={`absolute left-4 transition-all duration-200 pointer-events-none ${filled ? 'top-2 text-xs font-medium' : 'top-4 text-sm text-gray-400'}`} style={{ color: filled ? primaryColor : undefined }}>
              {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          </div>
        );
      }
      case 'select':
        return <select value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className={`${base} ${ir} px-4 py-3 appearance-none`} onFocus={onFocus as any} onBlur={onBlur as any}><option value="">Select {field.label?.toLowerCase() ?? ''}...</option>{field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select>;
      case 'radio':
        return (
          <div className="space-y-2 mt-1">
            {field.options?.map((opt) => {
              const checked = formData[field.name] === opt;
              return (
                <label key={opt} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${checked ? 'border-2' : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'}`} style={checked ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={checked ? { borderColor: primaryColor } : { borderColor: '#d1d5db' }}>
                    {checked && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
                  </div>
                  <input type="radio" name={field.name} value={opt} checked={checked} onChange={(e) => handleChange(field.name, e.target.value)} className="sr-only" />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-2 mt-1">
            {field.options?.map((opt) => {
              const checked = (formData[field.name] || []).includes(opt);
              return (
                <label key={opt} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${checked ? 'border-2' : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'}`} style={checked ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}>
                  <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all" style={checked ? { borderColor: primaryColor, backgroundColor: primaryColor } : { borderColor: '#d1d5db' }}>
                    {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input type="checkbox" value={opt} checked={checked} onChange={(e) => { const cur = formData[field.name] || []; handleChange(field.name, e.target.checked ? [...cur, opt] : cur.filter((v: string) => v !== opt)); }} className="sr-only" />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      case 'linear_scale': {
        const min = field.min || 1; const max = field.max || 5;
        return (
          <div className="mt-1">
            <div className="flex justify-between text-xs text-gray-400 mb-2 px-1"><span>{min} — Low</span><span>High — {max}</span></div>
            <div className="flex gap-2">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                <button key={n} type="button" onClick={() => handleChange(field.name, n)} className="flex-1 py-2.5 border rounded-xl font-semibold text-sm transition-all" style={formData[field.name] === n ? { backgroundColor: primaryColor, color: '#fff', borderColor: primaryColor } : {}}>{n}</button>
              ))}
            </div>
          </div>
        );
      }
      case 'rating': {
        const maxStars = field.max || 5;
        return <div className="flex gap-2 mt-1">{Array.from({ length: maxStars }, (_, i) => i + 1).map((n) => <button key={n} type="button" onClick={() => handleChange(field.name, n)} className="text-3xl transition-all hover:scale-110" style={{ color: (formData[field.name] || 0) >= n ? '#f59e0b' : '#d1d5db' }}>★</button>)}</div>;
      }
      case 'multiple_choice_grid':
        return (
          <div className="overflow-x-auto mt-1"><table className="w-full border-collapse">
            <thead><tr><th className="p-2" />{(field.columns || []).map((col) => <th key={col} className="p-2 text-center text-xs font-medium text-gray-500">{col}</th>)}</tr></thead>
            <tbody>{(field.rows || []).map((row) => (<tr key={row} className="border-t border-gray-100"><td className="p-2 text-sm text-gray-700 pr-4 font-medium">{row}</td>{(field.columns || []).map((col) => (<td key={col} className="p-2 text-center"><input type="radio" name={`${field.name}_${row}`} value={col} checked={formData[field.name]?.[row] === col} onChange={(e) => handleChange(field.name, { ...(formData[field.name] || {}), [row]: e.target.value })} className="w-4 h-4" style={{ accentColor: primaryColor }} /></td>))}</tr>))}</tbody>
          </table></div>
        );
      case 'checkbox_grid':
        return (
          <div className="overflow-x-auto mt-1"><table className="w-full border-collapse">
            <thead><tr><th className="p-2" />{(field.columns || []).map((col) => <th key={col} className="p-2 text-center text-xs font-medium text-gray-500">{col}</th>)}</tr></thead>
            <tbody>{(field.rows || []).map((row) => (<tr key={row} className="border-t border-gray-100"><td className="p-2 text-sm text-gray-700 pr-4 font-medium">{row}</td>{(field.columns || []).map((col) => { const rv = formData[field.name]?.[row] || []; return (<td key={col} className="p-2 text-center"><input type="checkbox" checked={rv.includes(col)} onChange={(e) => { const cur = formData[field.name] || {}; const rvv = cur[row] || []; handleChange(field.name, { ...cur, [row]: e.target.checked ? [...rvv, col] : rvv.filter((v: string) => v !== col) }); }} className="w-4 h-4 rounded" style={{ accentColor: primaryColor }} /></td>); })}</tr>))}</tbody>
          </table></div>
        );
      case 'time': return <input type="time" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className={`${base} ${ir} px-4 py-3`} onFocus={onFocus as any} onBlur={onBlur as any} />;
      case 'date': return <input type="date" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className={`${base} ${ir} px-4 py-3`} onFocus={onFocus as any} onBlur={onBlur as any} />;
      default: {
        const icon = getFieldIcon(field.name, field.type);
        const filled = !!formData[field.name];
        return (
          <div className="relative">
            {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">{icon}</div>}
            <input type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'} value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className={`${base} ${ir} ${icon ? 'pl-11 pr-4' : 'px-4'} pt-6 pb-3`} placeholder=" " id={`pf-${field.name}`} onFocus={onFocus as any} onBlur={onBlur as any} />
            <label htmlFor={`pf-${field.name}`} className={`absolute transition-all duration-200 pointer-events-none ${filled ? 'top-2 text-xs font-medium' : 'top-4 text-sm text-gray-400'} ${icon ? 'left-11' : 'left-4'}`} style={{ color: filled ? primaryColor : undefined }}>
              {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          </div>
        );
      }
    }
  };

  const FormCard = () => (
    <>
      {design.showProgress && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">Form Progress</span>
            <span className="font-semibold" style={{ color: primaryColor }}>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: primaryColor }} />
          </div>
        </div>
      )}
      <div className="bg-white shadow-xl p-6 sm:p-8" style={{ borderRadius: cardRadius }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field) => (
            <div key={field.name}>
              {!['text', 'email', 'phone', 'number', 'textarea'].includes(field.type) && (
                <label className="block text-sm font-semibold text-gray-700 mb-2">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>
              )}
              {renderField(field)}
              {errors[field.name] && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}
          <button type="submit" disabled={submitting} className="w-full py-3.5 px-6 font-semibold text-base text-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0" style={{ borderRadius: btnRadius, background: `linear-gradient(135deg, ${primaryColor}, ${pageConfig.secondaryColor})` }}>
            {submitting ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Submitting...</span> : 'Submit Enquiry'}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div style={{ ...themeVars, ...pageBg }} className="min-h-screen">

      {/* ── Floating Contact Buttons ──────────────────────────────── */}
      {(pageConfig.showWhatsapp || pageConfig.showCall || pageConfig.showEmail) && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
          {pageConfig.showEmail && pageConfig.contactEmailBtn && (
            <a href={`mailto:${pageConfig.contactEmailBtn}`} className="rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110" style={{ backgroundColor: '#6366f1', width: 52, height: 52 }} title="Email Us">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </a>
          )}
          {pageConfig.showCall && pageConfig.callNumber && (
            <a href={`tel:${pageConfig.callNumber}`} className="rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110" style={{ backgroundColor: '#0ea5e9', width: 52, height: 52 }} title="Call Us">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </a>
          )}
          {pageConfig.showWhatsapp && pageConfig.whatsappNumber && (
            <a href={`https://wa.me/${pageConfig.whatsappNumber.replace(/\D/g, '')}`} className="rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110" style={{ backgroundColor: '#25d366', width: 52, height: 52 }} title="WhatsApp Us" target="_blank" rel="noopener noreferrer">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            </a>
          )}
        </div>
      )}

      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <header className="w-full py-3 px-5 shadow-md" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${pageConfig.secondaryColor})` }}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          {displayLogo && (
            <img src={displayLogo} alt="Logo" className="h-8 object-contain drop-shadow flex-shrink-0" />
          )}
          {!displayLogo && (
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">{displayCompanyName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="text-base sm:text-lg font-bold text-white">{displayCompanyName}</span>
        </div>
      </header>

      {/* ── Banner (below header) ─────────────────────────────────── */}
      {pageConfig.bannerImage && (
        <div className="px-4 pt-4 pb-2">
          <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-md" style={{ height: 220 }}>
            <img src={pageConfig.bannerImage} alt="Banner" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* ── About Section ─────────────────────────────────────────── */}
      {pageConfig.showAbout && pageConfig.aboutText && (
        <section className="px-4 py-4">
          <div className="max-w-4xl mx-auto rounded-2xl p-8 text-center shadow-sm" style={{ backgroundColor: `${primaryColor}08` }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{pageConfig.aboutTitle}</h2>
            <div className="w-14 h-1 rounded mx-auto mb-5" style={{ backgroundColor: primaryColor }} />
            <p className="text-gray-600 text-base leading-relaxed max-w-2xl mx-auto whitespace-pre-line">{pageConfig.aboutText}</p>
          </div>
        </section>
      )}

      {/* ── Services Section ──────────────────────────────────────── */}
      {pageConfig.showServices && pageConfig.services?.length > 0 && (
        <section className="px-4 py-4">
          <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="text-center mb-7">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{pageConfig.servicesTitle}</h2>
              <div className="w-14 h-1 rounded mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageConfig.services.map((svc, i) => (
                <div key={i} className="p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white" style={{ borderRadius: cardRadius }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}18` }}>
                    <span className="text-xl font-bold" style={{ color: primaryColor }}>{String.fromCharCode(65 + i)}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{svc.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{svc.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Why Choose Us ─────────────────────────────────────────── */}
      {pageConfig.showWhyUs && pageConfig.whyUsPoints?.length > 0 && (
        <section className="px-4 py-4">
          <div className="max-w-4xl mx-auto rounded-2xl p-8 shadow-sm" style={{ background: `linear-gradient(135deg, ${primaryColor}08, ${pageConfig.secondaryColor}08)` }}>
            <div className="text-center mb-7">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{pageConfig.whyUsTitle}</h2>
              <div className="w-14 h-1 rounded mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pageConfig.whyUsPoints.filter(Boolean).map((pt, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${primaryColor}20` }}>
                    <svg className="w-4 h-4" fill="none" stroke={primaryColor} viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-gray-700 font-medium">{pt}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Gallery Section ───────────────────────────────────────── */}
      {pageConfig.showGallery && pageConfig.galleryImages?.filter(Boolean).length > 0 && (
        <section className="px-4 py-4">
          <div className={`max-w-5xl mx-auto rounded-2xl shadow-sm p-6 sm:p-8 ${pageConfig.backgroundImage ? 'bg-white/85 backdrop-blur-sm' : 'bg-white'}`}>
            <div className="text-center mb-7">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Gallery</h2>
              <div className="w-14 h-1 rounded mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pageConfig.galleryImages.filter(Boolean).map((img, i) => (
                <div key={i} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: cardRadius, aspectRatio: '4/3' }}>
                  <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Inquiry Form Section ──────────────────────────────────── */}
      <section className={`py-10 px-4 ${!hasAnySections ? 'min-h-screen flex flex-col items-center justify-center' : ''}`}>
        <div className={`w-full ${design.layout === 'split' ? 'max-w-5xl mx-auto' : 'max-w-lg mx-auto'}`}>
          {design.layout === 'split' ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <aside className="lg:col-span-2 p-7 shadow-lg h-fit" style={{ borderRadius: cardRadius, background: `linear-gradient(135deg, ${primaryColor}, ${pageConfig.secondaryColor})` }}>
                {displayLogo && <div className="mb-4 flex justify-center"><img src={displayLogo} alt="Logo" className="h-8 object-contain" /></div>}
                <h2 className="text-2xl font-bold text-white mb-2">{form?.title}</h2>
                <p className="text-white/80 text-sm leading-relaxed mb-6">{description || 'Please share your details. Our team will get in touch soon.'}</p>
                <div className="space-y-3">
                  {['Fast Response', 'Secure & Private', 'Professional Support'].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-white/90 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </aside>
              <div className="lg:col-span-3"><FormCard /></div>
            </div>
          ) : (
            <>
              {!hasAnySections && (
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center mb-5">
                    {displayLogo ? <img src={displayLogo} alt="Logo" className="h-10 object-contain" /> : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${pageConfig.secondaryColor})` }}>
                        <span className="text-lg font-bold text-white">{displayCompanyName.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">{form?.title}</h1>
                  {description && <p className="mt-2 text-gray-500 max-w-md mx-auto">{description}</p>}
                </div>
              )}
              {hasAnySections && (
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">{form?.title}</h2>
                  {description && <p className="mt-2 text-gray-500">{description}</p>}
                </div>
              )}
              <FormCard />
            </>
          )}
        </div>
      </section>

      {/* ── Contact + Map Section ─────────────────────────────────── */}
      {(pageConfig.showContact || (pageConfig.showMap && pageConfig.mapEmbedUrl)) && (
        <section className="px-4 py-4">
          <div className="max-w-5xl mx-auto rounded-2xl shadow-sm p-6 sm:p-8" style={{ backgroundColor: `${primaryColor}06` }}>
            <div className="text-center mb-7">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Contact Information</h2>
              <div className="w-14 h-1 rounded mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>
            <div className={`grid gap-6 ${pageConfig.showMap && pageConfig.mapEmbedUrl ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
              {pageConfig.showContact && (
                <div className="bg-white p-6 shadow-sm" style={{ borderRadius: cardRadius }}>
                  <h3 className="text-lg font-bold text-gray-900 mb-5">Get in Touch</h3>
                  <div className="space-y-4">
                    {pageConfig.contactPhone && (
                      <a href={`tel:${pageConfig.contactPhone}`} className="flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                          <svg className="w-5 h-5" fill="none" stroke={primaryColor} viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <div><p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Phone</p><p className="text-gray-800 font-semibold group-hover:underline">{pageConfig.contactPhone}</p></div>
                      </a>
                    )}
                    {pageConfig.contactEmail && (
                      <a href={`mailto:${pageConfig.contactEmail}`} className="flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                          <svg className="w-5 h-5" fill="none" stroke={primaryColor} viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div><p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Email</p><p className="text-gray-800 font-semibold group-hover:underline">{pageConfig.contactEmail}</p></div>
                      </a>
                    )}
                    {pageConfig.contactAddress && (
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${primaryColor}15` }}>
                          <svg className="w-5 h-5" fill="none" stroke={primaryColor} viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <div><p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Address</p><p className="text-gray-800 font-semibold leading-relaxed">{pageConfig.contactAddress}</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {pageConfig.showMap && pageConfig.mapEmbedUrl && (
                <div className="overflow-hidden shadow-sm" style={{ borderRadius: cardRadius, height: 300 }}>
                  <iframe src={pageConfig.mapEmbedUrl} width="100%" height="100%" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Location Map" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="py-8 px-4 border-t border-gray-200/60">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            {pageConfig.footerText || `© ${new Date().getFullYear()} ${displayCompanyName}. All rights reserved.`}
          </p>
          {(pageConfig.privacyUrl || pageConfig.termsUrl) && (
            <div className="flex items-center justify-center gap-6 mt-3">
              {pageConfig.privacyUrl && <a href={pageConfig.privacyUrl} className="text-xs text-gray-400 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>}
              {pageConfig.termsUrl && <a href={pageConfig.termsUrl} className="text-xs text-gray-400 hover:underline" target="_blank" rel="noopener noreferrer">Terms & Conditions</a>}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}