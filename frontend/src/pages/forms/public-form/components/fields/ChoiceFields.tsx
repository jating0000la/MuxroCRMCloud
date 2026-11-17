import { Check } from 'lucide-react';
import { FormField } from '../../../../../types';

interface ChoiceFieldProps {
  field: FormField;
  value: any;
  primaryColor: string;
  onChange: (value: any) => void;
}

/** Card-style radio buttons — bigger touch targets and a clear selected state than plain `<input type="radio">`. */
export function RadioCards({ field, value, primaryColor, onChange }: ChoiceFieldProps) {
  const options = field.options || [];
  return (
    <div className={`grid gap-2.5 mt-1 ${options.length > 4 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((opt) => {
        const checked = value === opt;
        return (
          <label
            key={opt}
            className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
              checked ? 'border-2 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
            }`}
            style={checked ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : undefined}
          >
            <span
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{ borderColor: checked ? primaryColor : '#d1d5db' }}
            >
              {checked && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />}
            </span>
            <input type="radio" name={field.name} value={opt} checked={checked} onChange={(e) => onChange(e.target.value)} className="sr-only" />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Card-style checkboxes matching RadioCards, backed by a string[] value. */
export function CheckboxCards({ field, value, primaryColor, onChange }: ChoiceFieldProps) {
  const options = field.options || [];
  const selected: string[] = value || [];

  const toggle = (opt: string, isChecked: boolean) => {
    onChange(isChecked ? [...selected, opt] : selected.filter((v) => v !== opt));
  };

  return (
    <div className={`grid gap-2.5 mt-1 ${options.length > 4 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
              checked ? 'border-2 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
            }`}
            style={checked ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : undefined}
          >
            <span
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
              style={{ borderColor: checked ? primaryColor : '#d1d5db', backgroundColor: checked ? primaryColor : 'transparent' }}
            >
              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <input type="checkbox" value={opt} checked={checked} onChange={(e) => toggle(opt, e.target.checked)} className="sr-only" />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}
