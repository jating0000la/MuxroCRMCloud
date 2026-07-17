import { BorderRadiusKey } from './types';

export const FONT_FAMILY_MAP: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  playfair: '"Playfair Display", serif',
  poppins: '"Poppins", sans-serif',
  montserrat: '"Montserrat", sans-serif',
  lato: '"Lato", sans-serif',
  opensans: '"Open Sans", sans-serif',
};

export const GOOGLE_FONTS: Record<string, string> = {
  inter: 'Inter:wght@300;400;500;600;700',
  roboto: 'Roboto:wght@300;400;500;700',
  playfair: 'Playfair+Display:wght@400;500;600;700',
  poppins: 'Poppins:wght@300;400;500;600;700',
  montserrat: 'Montserrat:wght@300;400;500;600;700',
  lato: 'Lato:wght@300;400;700',
  opensans: 'Open+Sans:wght@300;400;500;600;700',
};

export const BORDER_RADIUS_MAP: Record<BorderRadiusKey, string> = {
  none: '0px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  full: '9999px',
};

/** Trust badges shown in the hero / split-layout aside. Universal across industries. */
export const TRUST_BADGES = ['Fast Response', 'Secure & Private', 'Professional Support'];

/** Max size (bytes) for inline file-upload values, since submissions are plain JSON. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
