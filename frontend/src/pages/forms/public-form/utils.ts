import { FormField } from '../../../types';
import { DEFAULT_FORM_DESIGN, DEFAULT_PAGE_CONFIG, FormDesign, PageConfig, PublicFormConfig } from './types';

/**
 * Only allow navigating to http(s) URLs or same-origin relative paths.
 * Prevents a stored javascript:/data: URI (from form page config) from
 * executing when a public visitor's browser performs the redirect.
 */
export function isSafeRedirectUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Google Maps "share" links (e.g. copied from the app, or a `/maps/place/...` URL)
 * are NOT embeddable — dropping them into an <iframe> makes Google show a sign-in /
 * consent interstitial instead of the map. Only a proper `/maps/embed?...` or
 * `...output=embed` URL (from Google's "Share > Embed a map" flow) can be iframed.
 * This converts the common share-link shapes into an embeddable URL when possible,
 * and returns null when it can't be done safely so the caller can fall back to a
 * plain "Open in Google Maps" link instead of an iframe.
 */
export function getEmbeddableMapUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, window.location.origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  // Already a real embed URL (Google's "Embed a map" output, or any other provider
  // that was deliberately configured with output=embed / an /embed path).
  if (parsed.pathname.includes('/maps/embed') || parsed.searchParams.get('output') === 'embed') {
    return parsed.toString();
  }

  const isGoogleMaps = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) && parsed.pathname.startsWith('/maps');
  if (!isGoogleMaps) return null;

  // /maps/place/Some+Name/@12.34,56.78,15z/...
  const placeMatch = parsed.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (placeMatch) {
    const [, lat, lng] = placeMatch;
    return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
  }

  // /maps?q=<query> or /maps/search/?q=<query> (missing output=embed)
  const query = parsed.searchParams.get('q');
  if (query) {
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }

  // Short links (maps.app.goo.gl, goo.gl/maps/...) can't be resolved client-side.
  return null;
}

/** Splits the raw `fields` array (which may carry a hidden design-meta entry) into config + real fields. */
export function extractPublicFormConfig(allFields: FormField[]): PublicFormConfig {
  const metaField = allFields.find((f) => f.type === '__design_meta' || f.name === '__form_meta') as
    | (FormField & { meta?: { design?: Partial<FormDesign>; pageConfig?: Partial<PageConfig>; description?: string } })
    | undefined;
  const fields = allFields.filter((f) => f.type !== '__design_meta' && f.name !== '__form_meta');
  const design: FormDesign = { ...DEFAULT_FORM_DESIGN, ...(metaField?.meta?.design || {}) };
  const pageConfig: PageConfig = { ...DEFAULT_PAGE_CONFIG, ...(metaField?.meta?.pageConfig || {}) };
  const description: string = metaField?.meta?.description || '';
  return { fields, design, description, pageConfig };
}

/** Field types that should always take the full row width inside the 2-column desktop grid. */
const FULL_WIDTH_TYPES = new Set([
  'textarea',
  'multiple_choice_grid',
  'checkbox_grid',
  'file',
  'linear_scale',
]);

export function isFullWidthField(field: FormField): boolean {
  if (FULL_WIDTH_TYPES.has(field.type)) return true;
  if ((field.type === 'radio' || field.type === 'checkbox') && (field.options?.length || 0) > 4) return true;
  return false;
}

const CONTACT_FIELD_PATTERN = /name|email|phone|mobile|company|organi[sz]ation|website|city|address/i;

export interface FieldSection {
  title: string | null;
  fields: FormField[];
}

/**
 * Auto-groups fields into logical sections purely on the frontend (no backend/schema
 * changes needed). Contact-ish fields (name/email/phone/etc.) are grouped first under
 * "Contact Details", everything else falls under "Additional Information". Section
 * headers are only rendered when both groups are non-empty and the form is large enough
 * to benefit from the split.
 */
export function groupFieldsIntoSections(fields: FormField[]): FieldSection[] {
  if (fields.length <= 4) {
    return [{ title: null, fields }];
  }

  const contactFields = fields.filter((f) => CONTACT_FIELD_PATTERN.test(f.name) || CONTACT_FIELD_PATTERN.test(f.label));
  const otherFields = fields.filter((f) => !contactFields.includes(f));

  if (contactFields.length === 0 || otherFields.length === 0) {
    return [{ title: null, fields }];
  }

  return [
    { title: 'Contact Details', fields: contactFields },
    { title: 'Additional Information', fields: otherFields },
  ];
}

export function fieldElementId(name: string): string {
  return `pf-field-${name}`;
}
