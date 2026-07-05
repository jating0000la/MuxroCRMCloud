import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formService } from '../../services/forms';
import { Form, FormField } from '../../types';
import toast from 'react-hot-toast';

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadForm();
  }, [slug]);

  const loadForm = async () => {
    try {
      const data = await formService.getPublicForm(slug!);
      setForm(data);
    } catch (err) {
      setError('Form not found or no longer available');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fields = (form?.fields as FormField[]) || [];

    fields.forEach((field) => {
      const value = formData[field.name];
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors[field.name] = 'Please enter a valid email address';
      }
      if (value && field.type === 'phone' && !/^[\d\s\-+()]*$/.test(value)) {
        newErrors[field.name] = 'Please enter a valid phone number';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await formService.submitPublicForm(slug!, formData);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Available</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
            <p className="text-gray-500 mb-6">
              Your submission has been received successfully. We will get back to you soon.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({});
              }}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Submit Another Response
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fields = (form?.fields as FormField[]) || [];
  const progress = fields.length > 0
    ? Math.round((Object.keys(formData).filter((k) => formData[k] && formData[k].toString().trim() !== '').length / fields.length) * 100)
    : 0;

  const renderField = (field: FormField) => {
    const hasError = !!errors[field.name];

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
              hasError ? 'border-red-300' : 'border-gray-300'
            }`}
            rows={4}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'select':
        return (
          <select
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
              hasError ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name={field.name}
                  value={opt}
                  checked={formData[field.name] === opt}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  value={opt}
                  checked={(formData[field.name] || []).includes(opt)}
                  onChange={(e) => {
                    const current = formData[field.name] || [];
                    if (e.target.checked) {
                      handleChange(field.name, [...current, opt]);
                    } else {
                      handleChange(field.name, current.filter((v: string) => v !== opt));
                    }
                  }}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'file':
        return (
          <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            hasError ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
          }`}>
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <input
              type="file"
              onChange={(e) => handleChange(field.name, e.target.files?.[0]?.name || '')}
              className="hidden"
              id={`file-${field.name}`}
            />
            <label htmlFor={`file-${field.name}`} className="cursor-pointer">
              <span className="text-sm text-primary-600 hover:text-primary-700 font-medium">Click to upload</span>
              <span className="text-sm text-gray-500 ml-1">or drag and drop</span>
            </label>
            {formData[field.name] && (
              <p className="mt-2 text-sm text-gray-600">{formData[field.name]}</p>
            )}
          </div>
        );

      case 'linear_scale': {
        const min = field.min || 1;
        const max = field.max || 5;
        return (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{min}</span>
              <span>{max}</span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleChange(field.name, n)}
                  className={`flex-1 py-3 border rounded-lg font-medium transition-colors ${
                    formData[field.name] === n
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'rating': {
        const maxStars = field.max || 5;
        return (
          <div className="flex gap-1">
            {Array.from({ length: maxStars }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleChange(field.name, n)}
                className={`text-3xl transition-colors ${
                  (formData[field.name] || 0) >= n ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        );
      }

      case 'multiple_choice_grid':
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {(field.columns || []).map((col) => (
                    <th key={col} className="p-2 text-center text-xs font-medium text-gray-500">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(field.rows || []).map((row) => (
                  <tr key={row} className="border-t border-gray-100">
                    <td className="p-2 text-sm text-gray-700 pr-4">{row}</td>
                    {(field.columns || []).map((col) => (
                      <td key={col} className="p-2 text-center">
                        <input
                          type="radio"
                          name={`${field.name}_${row}`}
                          value={col}
                          checked={formData[field.name]?.[row] === col}
                          onChange={(e) => {
                            const current = formData[field.name] || {};
                            handleChange(field.name, { ...current, [row]: e.target.value });
                          }}
                          className="w-4 h-4 text-primary-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'checkbox_grid':
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {(field.columns || []).map((col) => (
                    <th key={col} className="p-2 text-center text-xs font-medium text-gray-500">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(field.rows || []).map((row) => (
                  <tr key={row} className="border-t border-gray-100">
                    <td className="p-2 text-sm text-gray-700 pr-4">{row}</td>
                    {(field.columns || []).map((col) => (
                      <td key={col} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={formData[field.name]?.[row]?.includes(col) || false}
                          onChange={(e) => {
                            const current = formData[field.name] || {};
                            const rowValues = current[row] || [];
                            if (e.target.checked) {
                              handleChange(field.name, { ...current, [row]: [...rowValues, col] });
                            } else {
                              handleChange(field.name, { ...current, [row]: rowValues.filter((v: string) => v !== col) });
                            }
                          }}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'time':
        return (
          <input
            type="time"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
              hasError ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
              hasError ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        );

      default: // text, email, phone, number
        return (
          <input
            type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
              hasError ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-xl font-bold text-white">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{form?.title}</h1>
          {(form as any)?.campaign?.name && (
            <p className="text-gray-500 mt-1">{(form as any).campaign.name}</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map((field, index) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Muxro CRM Cloud
        </p>
      </div>
    </div>
  );
}
