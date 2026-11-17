import { Star } from 'lucide-react';
import { FormField } from '../../../../../types';

interface ScaleFieldProps {
  field: FormField;
  value: any;
  primaryColor: string;
  onChange: (value: any) => void;
}

/** Star rating input, defaults to a 5-star scale (field.max overrides). */
export function RatingField({ field, value, onChange }: ScaleFieldProps) {
  const maxStars = field.max || 5;
  return (
    <div className="flex gap-1.5 mt-1">
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((n) => {
        const active = (value || 0) >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`Rate ${n} out of ${maxStars}`}
            className="transition-transform hover:scale-110"
          >
            <Star className="w-8 h-8" fill={active ? '#f59e0b' : 'none'} stroke={active ? '#f59e0b' : '#d1d5db'} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}

/** Numbered linear-scale selector (e.g. NPS-style 1-5 / 1-10 questions). */
export function LinearScaleField({ field, value, primaryColor, onChange }: ScaleFieldProps) {
  const min = field.min ?? 1;
  const max = field.max ?? 5;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-400 mb-2 px-1">
        <span>{min} — Low</span>
        <span>High — {max}</span>
      </div>
      <div className="flex gap-2">
        {steps.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="flex-1 py-2.5 border rounded-xl font-semibold text-sm transition-all"
              style={selected ? { backgroundColor: primaryColor, color: '#fff', borderColor: primaryColor } : { borderColor: '#e5e7eb' }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
