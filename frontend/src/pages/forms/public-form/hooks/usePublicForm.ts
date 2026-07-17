import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { formService } from '../../../../services/forms';
import { Form, FormField } from '../../../../types';
import { extractPublicFormConfig, isSafeRedirectUrl } from '../utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]*$/;

function validateFields(fields: FormField[], formData: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    const value = formData[field.name];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      errors[field.name] = `${field.label ?? 'This field'} is required`;
      return;
    }
    if (isEmpty) return;

    if (field.type === 'email' && !EMAIL_PATTERN.test(value)) {
      errors[field.name] = 'Please enter a valid email address';
    }
    if (field.type === 'phone' && !PHONE_PATTERN.test(value)) {
      errors[field.name] = 'Please enter a valid phone number';
    }
  });

  return errors;
}

export function usePublicForm(slug: string | undefined) {
  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    formService
      .getPublicForm(slug!)
      .then((data) => {
        if (!cancelled) setForm(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Form not found or no longer available');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { fields, design, description, pageConfig } = useMemo(
    () => extractPublicFormConfig((form?.fields as FormField[]) || []),
    [form],
  );

  const progress = useMemo(() => {
    if (fields.length === 0) return 0;
    const filled = fields.filter((f) => {
      const v = formData[f.name];
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v.toString().trim() !== '';
    }).length;
    return Math.round((filled / fields.length) * 100);
  }, [fields, formData]);

  const handleChange = useCallback((name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const newErrors = validateFields(fields, formData);
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) {
        const firstInvalid = document.getElementById(`pf-field-${Object.keys(newErrors)[0]}`);
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      setSubmitting(true);
      try {
        await formService.submitPublicForm(slug!, formData);
        setSubmitted(true);
        if (pageConfig.thankYouRedirectUrl && isSafeRedirectUrl(pageConfig.thankYouRedirectUrl)) {
          setTimeout(() => {
            window.location.href = pageConfig.thankYouRedirectUrl;
          }, 3000);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to submit form. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [fields, formData, pageConfig.thankYouRedirectUrl, slug],
  );

  const resetForm = useCallback(() => {
    setSubmitted(false);
    setFormData({});
    setErrors({});
  }, []);

  return {
    form,
    fields,
    design,
    description,
    pageConfig,
    formData,
    errors,
    loading,
    submitting,
    submitted,
    loadError,
    progress,
    handleChange,
    handleSubmit,
    resetForm,
  };
}
