export interface BrandingConfig {
  appName: string;
  appLogoUrl: string;
}

const BRANDING_STORAGE_KEY = 'appBranding';

export const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'Muxro CRM',
  appLogoUrl: '',
};

const toAbsoluteLogoUrl = (value: string): string => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  if (value.startsWith('/')) {
    return `${window.location.origin}${value}`;
  }
  return value;
};

export const readBranding = (): BrandingConfig => {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const parsed = JSON.parse(raw);
    return {
      appName: (parsed?.appName || DEFAULT_BRANDING.appName).toString(),
      appLogoUrl: toAbsoluteLogoUrl((parsed?.appLogoUrl || '').toString()),
    };
  } catch {
    return DEFAULT_BRANDING;
  }
};

export const saveBranding = (branding: BrandingConfig) => {
  localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
};

export const brandingFromSettings = (settings: Array<{ key: string; value: string }>): BrandingConfig => {
  const appNameSetting = settings.find((s) => s.key === 'companyName' || s.key === 'appName')?.value;
  const appLogoSetting = settings.find((s) => s.key === 'appLogoUrl' || s.key === 'companyLogo')?.value;

  return {
    appName: (appNameSetting || DEFAULT_BRANDING.appName).toString(),
    appLogoUrl: toAbsoluteLogoUrl((appLogoSetting || '').toString()),
  };
};
