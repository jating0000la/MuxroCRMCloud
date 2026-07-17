import { FormField } from '../../../../types';
import FieldRenderer from './fields/FieldRenderer';
import { isFullWidthField } from '../utils';

interface FormSectionProps {
  title: string | null;
  fields: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  primaryColor: string;
  onChange: (name: string, value: any) => void;
}

/** Renders one logical group of fields in a 2-column desktop / 1-column mobile grid. */
export default function FormSection({ title, fields, formData, errors, primaryColor, onChange }: FormSectionProps) {
  return (
    <div>
      {title && <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{title}</h3>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
        {fields.map((field) => (
          <div key={field.name} className={isFullWidthField(field) ? 'sm:col-span-2' : ''}>
            <FieldRenderer field={field} value={formData[field.name]} error={errors[field.name]} primaryColor={primaryColor} onChange={onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}
