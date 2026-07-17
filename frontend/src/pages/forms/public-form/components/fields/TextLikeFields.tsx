import { FormField } from '../../../../../types';
import { getFieldIcon } from './fieldIcons';
import { inputBaseClasses, useFocusRing } from './useFocusRing';
import { fieldElementId } from '../../utils';

interface FieldInputProps {
  field: FormField;
  value: any;
  hasError: boolean;
  primaryColor: string;
  onChange: (value: any) => void;
}

const HTML_INPUT_TYPE: Record<string, string> = { phone: 'tel', number: 'number' };

/** Floating-label input for text / email / phone / number fields, with an inferred leading icon. */
export function TextInputField({ field, value, hasError, primaryColor, onChange }: FieldInputProps) {
  const { onFocus, onBlur } = useFocusRing(primaryColor, hasError);
  const icon = getFieldIcon(field.name, field.type);
  const filled = value !== undefined && value !== null && value !== '';
  const inputId = `${fieldElementId(field.name)}-input`;

  return (
    <div className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">{icon}</div>}
      <input
        id={inputId}
        type={HTML_INPUT_TYPE[field.type] || 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder=" "
        className={`${inputBaseClasses(hasError)} ${icon ? 'pl-11 pr-4' : 'px-4'} pt-6 pb-3`}
      />
      <label
        htmlFor={inputId}
        className={`absolute transition-all duration-200 pointer-events-none ${
          filled ? 'top-2 text-xs font-medium' : 'top-4 text-sm text-gray-400'
        } ${icon ? 'left-11' : 'left-4'}`}
        style={{ color: filled ? primaryColor : undefined }}
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  );
}

/** Floating-label textarea for paragraph-style answers. */
export function TextAreaField({ field, value, hasError, primaryColor, onChange }: FieldInputProps) {
  const { onFocus, onBlur } = useFocusRing(primaryColor, hasError);
  const filled = !!value;
  const inputId = `${fieldElementId(field.name)}-input`;

  return (
    <div className="relative">
      <textarea
        id={inputId}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        rows={4}
        placeholder=" "
        className={`${inputBaseClasses(hasError)} px-4 pt-6 pb-3 resize-none`}
      />
      <label
        htmlFor={inputId}
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${filled ? 'top-2 text-xs font-medium' : 'top-4 text-sm text-gray-400'}`}
        style={{ color: filled ? primaryColor : undefined }}
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  );
}
