import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formService } from '../../services/forms';
import { Form, FormField } from '../../types';
import { readBranding } from '../../utils/branding';
import toast from 'react-hot-toast';

type FormDesignTheme = 'ocean' | 'sunset' | 'forest' | 'royal';
type FormDesignLayout = 'centered' | 'split';
type FormButtonStyle = 'solid' | 'gradient' | 'outline';
type FormRadiusStyle = 'soft' | 'rounded' | 'pill';

interface FormDesign {
  theme: FormDesignTheme;
  layout: FormDesignLayout;
  buttonStyle: FormButtonStyle;
  radius: FormRadiusStyle;
  showProgress: boolean;
  customColor: string;
}

const DEFAULT_FORM_DESIGN: FormDesign = {
  theme: 'ocean',
  layout: 'centered',
  buttonStyle: 'gradient',
  radius: 'rounded',
  showProgress: true,
  customColor: '#0ea5e9',
};

const extractPublicFormConfig = (allFields: FormField[]) => {
  const metaField = allFields.find((f) => f.type === '__design_meta' || f.name === '__form_meta') as any;
  const fields = allFields.filter((f) => f.type !== '__design_meta' && f.name !== '__form_meta');
  const design = {
    ...DEFAULT_FORM_DESIGN,
    ...(metaField?.meta?.design || {}),
  } as FormDesign;
  const description = metaField?.meta?.description || '';
  return { fields, design, description };
};

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const branding = readBranding();

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
    const fields = extractPublicFormConfig((form?.fields as FormField[]) || []).fields;

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
      <div className="sleek-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sleek-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Form Not Available</h1>
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="sleek-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Thank You!</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
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

  const { fields, design, description } = extractPublicFormConfig((form?.fields as FormField[]) || []);
  const progress = fields.length > 0
    ? Math.round((Object.keys(formData).filter((k) => formData[k] && formData[k].toString().trim() !== '').length / fields.length) * 100)
    : 0;

  const themeClasses: Record<FormDesignTheme, { page: string; card: string; accent: string; title: string; muted: string }> = {
    ocean: {
      page: 'from-sky-100 via-cyan-50 to-blue-100',
      card: 'border-cyan-200 bg-white/95',
      accent: 'from-sky-600 to-cyan-500',
      title: 'text-slate-900',
      muted: 'text-slate-600',
    },
    sunset: {
      page: 'from-rose-100 via-orange-50 to-amber-100',
      card: 'border-rose-200 bg-white/95',
      accent: 'from-rose-600 to-orange-500',
      title: 'text-slate-900',
      muted: 'text-slate-600',
    },
    forest: {
      page: 'from-emerald-100 via-lime-50 to-teal-100',
      card: 'border-emerald-200 bg-white/95',
      accent: 'from-emerald-600 to-lime-500',
      title: 'text-slate-900',
      muted: 'text-slate-600',
    },
    royal: {
      page: 'from-indigo-100 via-fuchsia-50 to-violet-100',
      card: 'border-indigo-200 bg-white/95',
      accent: 'from-indigo-600 to-fuchsia-500',
      title: 'text-slate-900',
      muted: 'text-slate-600',
    },
  };

  const radiusClass = design.radius === 'pill' ? 'rounded-3xl' : design.radius === 'soft' ? 'rounded-xl' : 'rounded-2xl';
  const activeTheme = themeClasses[design.theme];
  const validCustomColor = /^#([0-9a-fA-F]{6})$/.test(design.customColor || '') ? design.customColor : null;
  const accentStyle = validCustomColor
    ? { background: `linear-gradient(135deg, ${validCustomColor}, ${validCustomColor}cc)` }
    : undefined;
  const buttonStyle: React.CSSProperties | undefined =
    design.buttonStyle === 'gradient'
      ? validCustomColor
        ? { background: `linear-gradient(90deg, ${validCustomColor}, ${validCustomColor}cc)` }
        : undefined
      : design.buttonStyle === 'solid'
      ? validCustomColor
        ? { backgroundColor: validCustomColor }
        : undefined
      : validCustomColor
      ? { borderColor: validCustomColor, color: validCustomColor }
      : undefined;
  const buttonClass =
    design.buttonStyle === 'outline'
      ? 'border border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
      : design.buttonStyle === 'solid'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : `bg-gradient-to-r ${themeClasses[design.theme].accent} text-white hover:opacity-95`;

  const renderField = (field: FormField) => {
    const hasError = !!errors[field.name];

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
              hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
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
              hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
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
              <label key={opt} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="radio"
                  name={field.name}
                  value={opt}
                  checked={formData[field.name] === opt}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors">
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
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'linear_scale': {
        const min = field.min || 1;
        const max = field.max || 5;
        return (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
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
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
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
                  (formData[field.name] || 0) >= n ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-200'
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
                    <th key={col} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(field.rows || []).map((row) => (
                  <tr key={row} className="border-t border-gray-100 dark:border-t dark:border-gray-700">
                    <td className="p-2 text-sm text-gray-700 dark:text-gray-300 pr-4">{row}</td>
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
                    <th key={col} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(field.rows || []).map((row) => (
                  <tr key={row} className="border-t border-gray-100 dark:border-t dark:border-gray-700">
                    <td className="p-2 text-sm text-gray-700 dark:text-gray-300 pr-4">{row}</td>
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
              hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
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
              hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
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
              hasError ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
            }`}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className={`sleek-page min-h-screen bg-gradient-to-br ${activeTheme.page} py-8 px-4`}>
      <div className={`mx-auto ${design.layout === 'split' ? 'max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-6' : 'max-w-lg'}`}>
        {design.layout === 'split' && (
          <aside className={`lg:col-span-2 ${radiusClass} border ${activeTheme.card} p-6 shadow-lg h-fit`}>
            <div className={`w-12 h-12 bg-gradient-to-br ${activeTheme.accent} rounded-xl flex items-center justify-center mb-4 shadow-md overflow-hidden`} style={accentStyle}>
              {branding.appLogoUrl ? (
                <img src={branding.appLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-xl font-bold text-white">{(branding.appName || 'C').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <h2 className={`text-2xl font-bold ${activeTheme.title}`}>{form?.title}</h2>
            <p className={`mt-2 text-sm ${activeTheme.muted}`}>{description || 'Please share your details. Our team will contact you soon.'}</p>
            <div className="mt-6 space-y-2 text-sm text-slate-600 dark:text-gray-400">
              <p>Fast response from our team</p>
              <p>Secure data handling</p>
              <p>Quick callback and assistance</p>
            </div>
          </aside>
        )}

        <div className={design.layout === 'split' ? 'lg:col-span-3' : ''}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-12 h-12 bg-gradient-to-br ${activeTheme.accent} rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden`} style={accentStyle}>
            {branding.appLogoUrl ? (
              <img src={branding.appLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-xl font-bold text-white">{(branding.appName || 'C').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h1 className={`text-2xl font-bold ${activeTheme.title}`}>{form?.title}</h1>
          {description && <p className={`mt-2 text-sm ${activeTheme.muted}`}>{description}</p>}
          {(form as any)?.campaign?.name && (
            <p className={`mt-1 text-sm ${activeTheme.muted}`}>{(form as any).campaign.name}</p>
          )}
        </div>

        {/* Progress Bar */}
        {design.showProgress && (
          <div className="mb-6">
            <div className={`flex items-center justify-between text-sm ${activeTheme.muted} mb-2`}>
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-white/70 dark:bg-gray-700/70 rounded-full h-2 border border-white/60 dark:border-gray-600/60 overflow-hidden">
              <div
                className={`bg-gradient-to-r ${activeTheme.accent} h-2 rounded-full transition-all duration-300`}
                style={{ ...(accentStyle || {}), width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Form */}
        <div className={`border ${activeTheme.card} ${radiusClass} shadow-xl p-6 sm:p-8 backdrop-blur`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map((field, index) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className={`w-full py-3 px-4 font-medium ${radiusClass} focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${buttonClass}`}
              style={buttonStyle}
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
        <p className={`text-center text-xs ${activeTheme.muted} mt-6`}>
          Copyright by Muxro Technologies 2026
        </p>
        </div>
      </div>
    </div>
  );
}
