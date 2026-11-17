import { FormEvent, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { FormField } from '../../../../types';
import FormSection from './FormSection';
import { groupFieldsIntoSections } from '../utils';

interface FormCardProps {
  fields: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  primaryColor: string;
  secondaryColor: string;
  cardRadius: string;
  btnRadius: string;
  submitting: boolean;
  onChange: (name: string, value: any) => void;
  onSubmit: (e: FormEvent) => void;
}

/** The actual enquiry form: auto-grouped sections inside a premium white card. */
export default function FormCard({
  fields,
  formData,
  errors,
  primaryColor,
  secondaryColor,
  cardRadius,
  btnRadius,
  submitting,
  onChange,
  onSubmit,
}: FormCardProps) {
  const sections = useMemo(() => groupFieldsIntoSections(fields), [fields]);

  return (
    <div className="bg-white shadow-xl p-6 sm:p-8" style={{ borderRadius: cardRadius }}>
      <form onSubmit={onSubmit} className="space-y-7">
        {sections.map((section, i) => (
          <FormSection
            key={section.title || i}
            title={section.title}
            fields={section.fields}
            formData={formData}
            errors={errors}
            primaryColor={primaryColor}
            onChange={onChange}
          />
        ))}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-6 font-semibold text-base text-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          style={{ borderRadius: btnRadius, background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </span>
          ) : (
            'Submit Enquiry'
          )}
        </button>
      </form>
    </div>
  );
}
