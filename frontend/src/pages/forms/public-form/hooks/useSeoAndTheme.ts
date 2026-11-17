import { useEffect } from 'react';
import { Form, FormField } from '../../../../types';
import { BrandingConfig } from '../../../../utils/branding';
import { extractPublicFormConfig } from '../utils';
import { GOOGLE_FONTS } from '../constants';

function setMetaTag(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Injects SEO meta tags, favicon and Google Fonts for the active form's page config. */
export function useSeoAndTheme(form: Form | null, branding: BrandingConfig) {
  useEffect(() => {
    if (!form) return;
    const { pageConfig } = extractPublicFormConfig((form.fields as FormField[]) || []);

    document.title = pageConfig.metaTitle || form.title || branding.appName;

    if (pageConfig.metaDescription) setMetaTag('description', pageConfig.metaDescription);

    if (pageConfig.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = pageConfig.faviconUrl;
    }

    const fontKey = pageConfig.fontFamily;
    if (fontKey && fontKey !== 'system' && GOOGLE_FONTS[fontKey]) {
      const fontId = `gfont-${fontKey}`;
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[fontKey]}&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [form, branding.appName]);
}
