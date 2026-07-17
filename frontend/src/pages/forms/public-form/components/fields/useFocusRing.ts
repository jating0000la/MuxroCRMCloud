import { FocusEvent, useCallback } from 'react';

/** Shared focus/blur handlers that apply the theme's primary-color focus ring to native inputs. */
export function useFocusRing(primaryColor: string, hasError: boolean) {
  const onFocus = useCallback(
    (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (hasError) return;
      e.target.style.borderColor = primaryColor;
      e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
    },
    [primaryColor, hasError],
  );

  const onBlur = useCallback((e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '';
    e.target.style.boxShadow = '';
  }, []);

  return { onFocus, onBlur };
}

export function inputBaseClasses(hasError: boolean): string {
  return `w-full border transition-all duration-200 outline-none text-gray-800 text-sm rounded-xl ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
  }`;
}
