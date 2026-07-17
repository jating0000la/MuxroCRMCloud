import { FormField } from '../../../../../types';
import FieldWrapper, { FLOATING_LABEL_TYPES } from './FieldWrapper';
import { TextInputField, TextAreaField } from './TextLikeFields';
import SelectField from './SelectField';
import { RadioCards, CheckboxCards } from './ChoiceFields';
import { RatingField, LinearScaleField } from './ScaleFields';
import MatrixGridField from './MatrixGridField';
import DateTimeField from './DateTimeField';
import FileUploadField from './FileUploadField';

interface FieldRendererProps {
  field: FormField;
  value: any;
  error?: string;
  primaryColor: string;
  onChange: (name: string, value: any) => void;
}

/** Single entry point that picks the right input component for a field's type. */
export default function FieldRenderer({ field, value, error, primaryColor, onChange }: FieldRendererProps) {
  const handleChange = (v: any) => onChange(field.name, v);
  const showLabel = !FLOATING_LABEL_TYPES.has(field.type);

  const control = (() => {
    switch (field.type) {
      case 'textarea':
        return <TextAreaField field={field} value={value} hasError={!!error} primaryColor={primaryColor} onChange={handleChange} />;
      case 'select':
        return <SelectField field={field} value={value} hasError={!!error} primaryColor={primaryColor} onChange={handleChange} />;
      case 'radio':
        return <RadioCards field={field} value={value} primaryColor={primaryColor} onChange={handleChange} />;
      case 'checkbox':
        return <CheckboxCards field={field} value={value} primaryColor={primaryColor} onChange={handleChange} />;
      case 'rating':
        return <RatingField field={field} value={value} primaryColor={primaryColor} onChange={handleChange} />;
      case 'linear_scale':
        return <LinearScaleField field={field} value={value} primaryColor={primaryColor} onChange={handleChange} />;
      case 'multiple_choice_grid':
      case 'checkbox_grid':
        return <MatrixGridField field={field} value={value} primaryColor={primaryColor} onChange={handleChange} />;
      case 'date':
      case 'time':
        return <DateTimeField field={field} value={value} hasError={!!error} primaryColor={primaryColor} onChange={handleChange} />;
      case 'file':
        return <FileUploadField value={value} primaryColor={primaryColor} onChange={handleChange} />;
      default:
        return <TextInputField field={field} value={value} hasError={!!error} primaryColor={primaryColor} onChange={handleChange} />;
    }
  })();

  return (
    <FieldWrapper field={field} error={error} showLabel={showLabel}>
      {control}
    </FieldWrapper>
  );
}
