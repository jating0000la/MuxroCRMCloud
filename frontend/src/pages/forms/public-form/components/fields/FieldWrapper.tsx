import { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { FormField } from '../../../../../types';
import { fieldElementId } from '../../utils';

interface FieldWrapperProps {
  field: FormField;
  error?: string;
  showLabel: boolean;
  children: ReactNode;
}

/** Consistent label + error chrome around every field type. Floating-label inputs pass showLabel=false. */
export default function FieldWrapper({ field, error, showLabel, children }: FieldWrapperProps) {
  return (
    <div id={fieldElementId(field.name)}>
      {showLabel && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Field types that render their own floating label inside the input (no separate label row). */
export const FLOATING_LABEL_TYPES = new Set(['text', 'email', 'phone', 'number', 'textarea']);
