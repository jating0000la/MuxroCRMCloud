import { ChevronDown } from 'lucide-react';
import { FormField } from '../../../../../types';
import { inputBaseClasses, useFocusRing } from './useFocusRing';

interface SelectFieldProps {
  field: FormField;
  value: any;
  hasError: boolean;
  primaryColor: string;
  onChange: (value: any) => void;
}

export default function SelectField({ field, value, hasError, primaryColor, onChange }: SelectFieldProps) {
  const { onFocus, onBlur } = useFocusRing(primaryColor, hasError);

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${inputBaseClasses(hasError)} px-4 py-3 pr-10 appearance-none`}
      >
        <option value="">Select {field.label?.toLowerCase() ?? ''}...</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
