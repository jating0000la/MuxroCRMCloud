import { Calendar, Clock } from 'lucide-react';
import { FormField } from '../../../../../types';
import { inputBaseClasses, useFocusRing } from './useFocusRing';

interface DateTimeFieldProps {
  field: FormField;
  value: any;
  hasError: boolean;
  primaryColor: string;
  onChange: (value: any) => void;
}

export default function DateTimeField({ field, value, hasError, primaryColor, onChange }: DateTimeFieldProps) {
  const { onFocus, onBlur } = useFocusRing(primaryColor, hasError);
  const isTime = field.type === 'time';
  const Icon = isTime ? Clock : Calendar;

  return (
    <div className="relative">
      <Icon className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
      <input
        type={isTime ? 'time' : 'date'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${inputBaseClasses(hasError)} pl-11 pr-4 py-3`}
      />
    </div>
  );
}
