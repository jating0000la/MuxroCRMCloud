import { FormField } from '../../../types';

export type BorderRadiusKey = 'none' | 'sm' | 'md' | 'lg' | 'full';

export interface FormDesign {
  layout: 'centered' | 'split';
  buttonStyle: 'solid' | 'gradient' | 'outline';
  showProgress: boolean;
  customColor: string;
  theme?: string;
  radius?: string;
}

export interface ServiceItem {
  title: string;
  description: string;
}

export interface PageConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  backgroundImage: string;
  fontFamily: string;
  borderRadius: BorderRadiusKey;
  companyLogo: string;
  bannerImage: string;
  showAbout: boolean;
  aboutTitle: string;
  aboutText: string;
  showServices: boolean;
  servicesTitle: string;
  services: ServiceItem[];
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

export interface PublicFormConfig {
  fields: FormField[];
  design: FormDesign;
  description: string;
  pageConfig: PageConfig;
}

/** File-upload value stored inline in form submissions (no backend upload endpoint). */
export interface UploadedFileValue {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export const DEFAULT_FORM_DESIGN: FormDesign = {
  layout: 'centered',
  buttonStyle: 'gradient',
  showProgress: true,
  customColor: '#0ea5e9',
};

export const DEFAULT_PAGE_CONFIG: PageConfig = {
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
