import React, { useState, useMemo, useEffect, useCallback } from 'react';
import integrationService from '../../services/integrations';

interface FormBuilderField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  rows?: string[];
  columns?: string[];
  meta?: any;
}

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

interface FormCommunication {
  whatsappEnabled: boolean;
  templateId: string;
  greetingMessage: string;
}

const DEFAULT_FORM_COMMUNICATION: FormCommunication = {
  whatsappEnabled: false,
  templateId: '',
  greetingMessage: '',
};

const DEFAULT_FORM_DESIGN: FormDesign = {
  theme: 'ocean',
  layout: 'centered',
  buttonStyle: 'gradient',
  radius: 'rounded',
  showProgress: true,
  customColor: '#0ea5e9',
};

const DEFAULT_FIELDS: FormBuilderField[] = [
  { name: 'name', label: 'Full Name', type: 'text', required: true },
  { name: 'email', label: 'Email Address', type: 'text', required: false },
  { name: 'phone', label: 'Phone Number', type: 'text', required: false },
];

const BASIC_COLORS = [
  '#f87171', '#ef4444', '#b91c1c', '#f59e0b', '#facc15', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399',
  '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#fca5a5', '#fdba74',
  '#fcd34d', '#bef264', '#86efac', '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc',
];

const EMPTY_CUSTOM_SLOTS = Array.from({ length: 24 }, () => '');

interface InitialForm {
  id: string;
  title: string;
  fields: FormBuilderField[];
}

interface FormBuilderProps {
  initialForm?: InitialForm;
  onSubmit: (title: string, fields: FormBuilderField[]) => void;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short answer', icon: 'T' },
  { value: 'textarea', label: 'Paragraph', icon: '¶' },
  { value: 'radio', label: 'Multiple choice', icon: '◉' },
  { value: 'checkbox', label: 'Checkboxes', icon: '☑' },
  { value: 'select', label: 'Drop-down', icon: '▾' },
  { value: 'linear_scale', label: 'Linear scale', icon: '─' },
  { value: 'rating', label: 'Rating', icon: '★' },
  { value: 'multiple_choice_grid', label: 'Choice grid', icon: '⊞' },
  { value: 'checkbox_grid', label: 'Tick box grid', icon: '⊠' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'time', label: 'Time', icon: '◷' },
];

export default function FormBuilder({ initialForm, onSubmit, onCancel }: FormBuilderProps) {
  const initialConfig = useMemo(() => {
    const sourceFields = initialForm?.fields || DEFAULT_FIELDS;
    const metaField = sourceFields.find((f) => f.type === '__design_meta' || f.name === '__form_meta');
    const safeDesign = {
      ...DEFAULT_FORM_DESIGN,
      ...(metaField?.meta?.design || {}),
    } as FormDesign;
    const safeComm = {
      ...DEFAULT_FORM_COMMUNICATION,
      ...(metaField?.meta?.communication || {}),
    } as FormCommunication;

    return {
      title: initialForm?.title || '',
      description: metaField?.meta?.description || '',
      design: safeDesign,
      communication: safeComm,
      fields: sourceFields.filter((f) => f.type !== '__design_meta' && f.name !== '__form_meta'),
    };
  }, [initialForm]);

  const [title, setTitle] = useState(initialConfig.title);
  const [description, setDescription] = useState(initialConfig.description);
  const [fields, setFields] = useState<FormBuilderField[]>(initialConfig.fields.length > 0 ? initialConfig.fields : DEFAULT_FIELDS);
  const [design, setDesign] = useState<FormDesign>(initialConfig.design);
  const [communication, setCommunication] = useState<FormCommunication>(initialConfig.communication);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [builderTab, setBuilderTab] = useState<'fields' | 'design' | 'communication'>('fields');
  const [customColorSlots, setCustomColorSlots] = useState<string[]>(EMPTY_CUSTOM_SLOTS);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [templatesFetched, setTemplatesFetched] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const result = await integrationService.syncGupshupTemplates();
      if (result.success) {
        setTemplates(result.templates || []);
        setTemplatesFetched(true);
      } else {
        setTemplatesError(result.error || 'Failed to fetch templates');
      }
    } catch (err: any) {
      setTemplatesError(err.response?.data?.message || err.message || 'Failed to fetch templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (builderTab === 'communication' && communication.whatsappEnabled && !templatesFetched && !templatesLoading) {
      fetchTemplates();
    }
  }, [builderTab, communication.whatsappEnabled, templatesFetched, templatesLoading, fetchTemplates]);

  const normalizeHexColor = (value: string) => {
    const trimmed = value.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return /^#([0-9a-fA-F]{6})$/.test(withHash) ? withHash : null;
  };

  const hexToRgb = (hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return { r: 14, g: 165, b: 233 };
    const h = normalized.slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
  };

  const currentRgb = useMemo(() => hexToRgb(design.customColor), [design.customColor]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';

  const addField = (type: string) => {
    const newField: FormBuilderField = {
      name: '',
      label: `New ${FIELD_TYPES.find((t) => t.value === type)?.label || 'Field'}`,
      type,
      required: false,
      placeholder: '',
      options: ['radio', 'checkbox', 'select', 'multiple_choice_grid', 'checkbox_grid'].includes(type)
        ? ['Option 1', 'Option 2']
        : undefined,
      min: type === 'linear_scale' || type === 'rating' ? 1 : undefined,
      max: type === 'linear_scale' || type === 'rating' ? 5 : undefined,
      rows: type === 'multiple_choice_grid' || type === 'checkbox_grid' ? ['Row 1', 'Row 2'] : undefined,
      columns: type === 'multiple_choice_grid' || type === 'checkbox_grid' ? ['Col 1', 'Col 2'] : undefined,
    };
    newField.name = slugify(newField.label);
    const newFields = [...fields, newField];
    setFields(newFields);
    setSelectedFieldIndex(newFields.length - 1);
  };

  const updateField = (index: number, key: string, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    if (key === 'label') updated[index].name = slugify(value);
    if (key === 'type') {
      const field = updated[index];
      delete field.options;
      delete field.min;
      delete field.max;
      delete field.rows;
      delete field.columns;
      if (['radio', 'checkbox', 'select', 'multiple_choice_grid', 'checkbox_grid'].includes(value)) {
        field.options = ['Option 1', 'Option 2'];
      }
      if (value === 'linear_scale' || value === 'rating') {
        field.min = 1;
        field.max = 5;
      }
      if (value === 'multiple_choice_grid' || value === 'checkbox_grid') {
        field.rows = ['Row 1', 'Row 2'];
        field.columns = ['Col 1', 'Col 2'];
      }
    }
    setFields(updated);
  };

  const deleteField = (index: number) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((_, i) => i !== index));
    if (selectedFieldIndex === index) setSelectedFieldIndex(null);
    else if (selectedFieldIndex !== null && selectedFieldIndex > index) setSelectedFieldIndex(selectedFieldIndex - 1);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFields(updated);
  };

  const updateListItem = (fieldIndex: number, key: 'options' | 'rows' | 'columns', listIndex: number, value: string) => {
    const updated = [...fields];
    const list = [...(updated[fieldIndex][key] || [])];
    list[listIndex] = value;
    updated[fieldIndex] = { ...updated[fieldIndex], [key]: list };
    setFields(updated);
  };

  const addListItem = (fieldIndex: number, key: 'options' | 'rows' | 'columns') => {
    const updated = [...fields];
    const list = [...(updated[fieldIndex][key] || [])];
    list.push(`${key === 'options' ? 'Option' : key === 'rows' ? 'Row' : 'Col'} ${list.length + 1}`);
    updated[fieldIndex] = { ...updated[fieldIndex], [key]: list };
    setFields(updated);
  };

  const removeListItem = (fieldIndex: number, key: 'options' | 'rows' | 'columns', listIndex: number) => {
    const updated = [...fields];
    const list = (updated[fieldIndex][key] || []).filter((_: any, i: number) => i !== listIndex);
    updated[fieldIndex] = { ...updated[fieldIndex], [key]: list };
    setFields(updated);
  };

  const needsOptions = (type: string) => ['radio', 'checkbox', 'select'].includes(type);
  const needsGrid = (type: string) => ['multiple_choice_grid', 'checkbox_grid'].includes(type);
  const needsScale = (type: string) => type === 'linear_scale';
  const needsRating = (type: string) => type === 'rating';

  const duplicateField = (index: number) => {
    const field = fields[index];
    const copiedLabel = `${field.label} Copy`;
    const copied: FormBuilderField = {
      ...field,
      name: slugify(copiedLabel),
      label: copiedLabel,
    };
    const updated = [...fields];
    updated.splice(index + 1, 0, copied);
    setFields(updated);
    setSelectedFieldIndex(index + 1);
  };

  const addLeadCaptureTemplate = () => {
    const requiredFields: FormBuilderField[] = [
      { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter full name' },
      { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: 'Enter phone number' },
      { name: 'email', label: 'Email Address', type: 'text', required: false, placeholder: 'Enter email address' },
      { name: 'city', label: 'City', type: 'text', required: false, placeholder: 'Enter city' },
      {
        name: 'interest',
        label: 'Interested Service',
        type: 'select',
        required: true,
        options: ['Service A', 'Service B', 'Service C'],
      },
    ];
    setFields(requiredFields);
    setSelectedFieldIndex(0);
  };

  const renderFieldPreview = (field: FormBuilderField) => {
    switch (field.type) {
      case 'text':
        return <input disabled placeholder={field.placeholder || field.label} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />;
      case 'textarea':
        return <textarea disabled placeholder={field.placeholder || field.label} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 h-20" />;
      case 'radio':
        return (
          <div className="space-y-1 mt-1">
            {field.options?.map((o, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <input type="radio" disabled className="text-primary-600" />{o}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-1 mt-1">
            {field.options?.map((o, i) => (
              <label key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" disabled className="text-primary-600 rounded" />{o}
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50">
            <option>Select...</option>
            {field.options?.map((o, i) => <option key={i}>{o}</option>)}
          </select>
        );
      case 'date':
        return <input type="date" disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />;
      case 'time':
        return <input type="time" disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />;
      case 'linear_scale':
        return (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-gray-400">{field.min}</span>
            {Array.from({ length: (field.max || 5) - (field.min || 1) + 1 }, (_, i) => (field.min || 1) + i).map((n) => (
              <span key={n} className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-sm text-gray-500">{n}</span>
            ))}
            <span className="text-xs text-gray-400">{field.max}</span>
          </div>
        );
      case 'rating':
        return (
          <div className="flex gap-1 mt-1">
            {Array.from({ length: field.max || 5 }, (_, i) => (
              <span key={i} className="text-xl text-gray-300">★</span>
            ))}
          </div>
        );
      case 'multiple_choice_grid':
      case 'checkbox_grid':
        return (
          <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {field.columns?.map((c, i) => <th key={i} className="p-2 text-left text-xs font-medium text-gray-500">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {field.rows?.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-2 text-sm text-gray-700">{r}</td>
                    {field.columns?.slice(1).map((_, ci) => (
                      <td key={ci} className="p-2 text-center">
                        <input type={field.type === 'checkbox_grid' ? 'checkbox' : 'radio'} disabled className="text-primary-600" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <input disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />;
    }
  };

  return (
    <div className="flex flex-col h-[90vh]">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{initialForm ? 'Edit Form' : 'Create Form'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              builderTab === 'fields' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBuilderTab('fields')}
          >
            Form Fields
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              builderTab === 'design' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBuilderTab('design')}
          >
            Design
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              builderTab === 'communication' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBuilderTab('communication')}
          >
            Communication
          </button>
        </div>
      </div>

      {/* Body */}
      {builderTab === 'fields' ? (
        <div className="flex flex-1 min-h-0">
          {/* Left: Field palette */}
          <div className="w-56 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto flex-shrink-0">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Form Elements</h3>
            <button
              onClick={addLeadCaptureTemplate}
              className="w-full mb-3 px-3 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
            >
              Use Lead Capture Template
            </button>
            <div className="space-y-2">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => addField(ft.value)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-medium text-gray-600">{ft.icon}</span>
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Form Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="e.g., Contact Us Form"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm h-20"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-3 min-h-[300px] border-2 border-dashed border-gray-300 rounded-xl p-4">
              {fields.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <p className="text-4xl mb-2">+</p>
                  <p className="text-sm">Add form elements from the left panel</p>
                </div>
              ) : (
                fields.map((field, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedFieldIndex(idx)}
                    className={`p-4 border rounded-xl bg-white cursor-pointer transition-all ${
                      selectedFieldIndex === idx ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 cursor-grab">⋮⋮</span>
                        <span className="text-sm font-medium text-gray-900">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {FIELD_TYPES.find((ft) => ft.value === field.type)?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); moveField(idx, 'up'); }} disabled={idx === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-400">
                          ↑
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveField(idx, 'down'); }} disabled={idx === fields.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-400">
                          ↓
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); duplicateField(idx); }} className="p-1 hover:bg-gray-100 rounded text-gray-400" title="Duplicate">
                          ⧉
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteField(idx); }} disabled={fields.length <= 1} className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded disabled:opacity-30">
                          ✕
                        </button>
                      </div>
                    </div>
                    {renderFieldPreview(field)}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Properties panel */}
          <div className="w-72 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto flex-shrink-0">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Field Properties</h3>
            {selectedFieldIndex !== null && fields[selectedFieldIndex] ? (() => {
              const sf = fields[selectedFieldIndex];
              return (
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                    <input
                      value={sf.label}
                      onChange={(e) => updateField(selectedFieldIndex, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={sf.type}
                      onChange={(e) => updateField(selectedFieldIndex, 'type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.icon} {ft.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                    <input
                      value={sf.placeholder || ''}
                      onChange={(e) => updateField(selectedFieldIndex, 'placeholder', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Optional placeholder"
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sf.required}
                      onChange={(e) => updateField(selectedFieldIndex, 'required', e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Required</span>
                  </label>

                  {/* Options for radio, checkbox, select */}
                  {needsOptions(sf.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
                      <div className="space-y-2">
                        {sf.options?.map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <input
                              value={opt}
                              onChange={(e) => updateListItem(selectedFieldIndex, 'options', oi, e.target.value)}
                              className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
                            />
                            <button
                              onClick={() => removeListItem(selectedFieldIndex, 'options', oi)}
                              disabled={(sf.options || []).length <= 1}
                              className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                            >✕</button>
                          </div>
                        ))}
                        <button
                          onClick={() => addListItem(selectedFieldIndex, 'options')}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >+ Add option</button>
                      </div>
                    </div>
                  )}

                  {/* Linear scale */}
                  {needsScale(sf.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Scale Range</label>
                      <div className="flex items-center gap-2">
                        <input type="number" value={sf.min || 1} onChange={(e) => updateField(selectedFieldIndex, 'min', parseInt(e.target.value) || 1)} className="w-16 px-2 py-1.5 border border-gray-200 rounded text-sm" min={0} max={10} />
                        <span className="text-gray-400">to</span>
                        <input type="number" value={sf.max || 5} onChange={(e) => updateField(selectedFieldIndex, 'max', parseInt(e.target.value) || 5)} className="w-16 px-2 py-1.5 border border-gray-200 rounded text-sm" min={1} max={10} />
                      </div>
                    </div>
                  )}

                  {/* Rating */}
                  {needsRating(sf.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Max Stars</label>
                      <input type="number" value={sf.max || 5} onChange={(e) => updateField(selectedFieldIndex, 'max', Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))} className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm" min={1} max={10} />
                    </div>
                  )}

                  {/* Grid rows/columns */}
                  {needsGrid(sf.type) && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Rows</label>
                        <div className="space-y-2">
                          {sf.rows?.map((row, ri) => (
                            <div key={ri} className="flex gap-2">
                              <input value={row} onChange={(e) => updateListItem(selectedFieldIndex, 'rows', ri, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm" />
                              <button onClick={() => removeListItem(selectedFieldIndex, 'rows', ri)} disabled={(sf.rows || []).length <= 1} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30">✕</button>
                            </div>
                          ))}
                          <button onClick={() => addListItem(selectedFieldIndex, 'rows')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add row</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Columns</label>
                        <div className="space-y-2">
                          {sf.columns?.map((col, ci) => (
                            <div key={ci} className="flex gap-2">
                              <input value={col} onChange={(e) => updateListItem(selectedFieldIndex, 'columns', ci, e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm" />
                              <button onClick={() => removeListItem(selectedFieldIndex, 'columns', ci)} disabled={(sf.columns || []).length <= 1} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30">✕</button>
                            </div>
                          ))}
                          <button onClick={() => addListItem(selectedFieldIndex, 'columns')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add column</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })() : (
              <p className="text-gray-400 text-sm">Select a field to edit its properties</p>
            )}
          </div>
        </div>
      ) : builderTab === 'communication' ? (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-1">WhatsApp Communication</h3>
            <p className="text-sm text-gray-500 mb-5">Configure WhatsApp message templates for this form's submissions.</p>

            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable WhatsApp Greeting</p>
                  <p className="text-xs text-gray-500 mt-0.5">Send a WhatsApp template message when someone submits this form</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCommunication((prev) => ({ ...prev, whatsappEnabled: !prev.whatsappEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    communication.whatsappEnabled ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      communication.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {communication.whatsappEnabled && (
                <>
                  <div className="p-4 border border-gray-200 rounded-xl space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">WhatsApp Template</label>
                        <button
                          type="button"
                          onClick={fetchTemplates}
                          disabled={templatesLoading}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                        >
                          {templatesLoading ? (
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          )}
                          {templatesLoading ? 'Syncing...' : 'Refresh'}
                        </button>
                      </div>
                      {templates.length > 0 ? (
                        <select
                          value={communication.templateId}
                          onChange={(e) => setCommunication((prev) => ({ ...prev, templateId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select a template...</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.language}) — {t.status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={communication.templateId}
                          onChange={(e) => setCommunication((prev) => ({ ...prev, templateId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter template ID manually"
                        />
                      )}
                      {templatesError && <p className="text-xs text-red-500 mt-1">{templatesError}</p>}
                      {!templatesError && templates.length === 0 && templatesFetched && (
                        <p className="text-xs text-amber-600 mt-1">No templates found. Check your Gupshup App ID in Settings.</p>
                      )}
                      {templates.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{templates.length} template(s) synced from Gupshup</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Greeting Message</label>
                      <textarea
                        value={communication.greetingMessage}
                        onChange={(e) => setCommunication((prev) => ({ ...prev, greetingMessage: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 focus:ring-2 focus:ring-primary-500"
                        placeholder="Thank you for your inquiry, {{name}}! We will get back to you shortly."
                      />
                      <p className="text-xs text-gray-400 mt-1">Use {'{{name}}'} to insert the submitter's name. This is sent as the first template parameter.</p>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">How it works</h4>
                    <ul className="text-xs text-green-800 space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">1.</span>
                        <span>Lead submits the public form</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">2.</span>
                        <span>CRM creates the lead and assigns a telecaller</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">3.</span>
                        <span>WhatsApp template is sent to the lead's phone number</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">4.</span>
                        <span>Gupshup global config (API key, source, app name) is used from Settings</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Template Preview</h4>
                    {(() => {
                      const selected = templates.find((t) => t.id === communication.templateId);
                      if (!selected && !communication.greetingMessage) {
                        return (
                          <p className="text-xs text-blue-600">Select a template above to see a preview.</p>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {selected && (
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Template</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{selected.language}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selected.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{selected.status}</span>
                              </div>
                              {selected.body && (
                                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
                              )}
                              {!selected.body && (
                                <p className="text-xs text-gray-400 italic">Template body not available in API response</p>
                              )}
                            </div>
                          )}
                          <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">WhatsApp Message</span>
                            </div>
                            <p className="text-xs text-gray-700">
                              {communication.greetingMessage
                                ? communication.greetingMessage.replace(/\{\{name\}\}/g, 'John Doe')
                                : 'Thank you for your inquiry, John Doe! We will get back to you shortly.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Form Design Studio</h3>
            <p className="text-sm text-gray-500 mb-5">Tune layout, colors, and button style directly.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Quick Tune</label>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">Layout</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDesign((prev) => ({ ...prev, layout: 'centered' }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                          design.layout === 'centered' ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Centered
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesign((prev) => ({ ...prev, layout: 'split' }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                          design.layout === 'split' ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Split
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">Button</p>
                    <div className="flex flex-wrap gap-2">
                      {(['solid', 'gradient', 'outline'] as FormButtonStyle[]).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setDesign((prev) => ({ ...prev, buttonStyle: style }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border capitalize ${
                            design.buttonStyle === style ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="show-progress"
                      type="checkbox"
                      checked={design.showProgress}
                      onChange={(e) => setDesign((prev) => ({ ...prev, showProgress: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <label htmlFor="show-progress" className="text-sm text-gray-700">Show progress bar</label>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">Accent Color</p>
                    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={normalizeHexColor(design.customColor) || '#0EA5E9'}
                          onChange={(e) => setDesign((prev) => ({ ...prev, customColor: e.target.value.toUpperCase() }))}
                          className="h-16 w-20 rounded border border-gray-300 bg-white p-1 cursor-pointer"
                        />
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          <input
                            type="text"
                            value={design.customColor}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: e.target.value }))}
                            onBlur={(e) => {
                              const normalized = normalizeHexColor(e.target.value);
                              setDesign((prev) => ({ ...prev, customColor: (normalized || prev.customColor).toUpperCase() }));
                            }}
                            className="col-span-2 px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md uppercase"
                            placeholder="#0EA5E9"
                          />
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={currentRgb.r}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: rgbToHex(Number(e.target.value), currentRgb.g, currentRgb.b) }))}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md"
                          />
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={currentRgb.g}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: rgbToHex(currentRgb.r, Number(e.target.value), currentRgb.b) }))}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md"
                          />
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={currentRgb.b}
                            onChange={(e) => setDesign((prev) => ({ ...prev, customColor: rgbToHex(currentRgb.r, currentRgb.g, Number(e.target.value)) }))}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const current = normalizeHexColor(design.customColor);
                              if (!current) return;
                              setCustomColorSlots((prev) => {
                                const next = [...prev];
                                const existing = next.findIndex((c) => c.toLowerCase() === current.toLowerCase());
                                if (existing >= 0) return next;
                                const emptyIndex = next.findIndex((c) => !c);
                                if (emptyIndex >= 0) {
                                  next[emptyIndex] = current.toUpperCase();
                                } else {
                                  next[next.length - 1] = current.toUpperCase();
                                }
                                return next;
                              });
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                          >
                            Add to Custom
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Basic Colors</p>
                        <div className="grid grid-cols-12 gap-1.5">
                          {BASIC_COLORS.map((color) => {
                            const active = (normalizeHexColor(design.customColor) || '').toLowerCase() === color.toLowerCase();
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setDesign((prev) => ({ ...prev, customColor: color.toUpperCase() }))}
                                className={`h-5 w-5 rounded-full border ${active ? 'ring-2 ring-primary-400 border-primary-500' : 'border-black/10 hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Custom Colors</p>
                        <div className="grid grid-cols-8 gap-1.5">
                          {customColorSlots.map((color, idx) => {
                            const active = color && (normalizeHexColor(design.customColor) || '').toLowerCase() === color.toLowerCase();
                            return color ? (
                              <button
                                key={`custom-${idx}`}
                                type="button"
                                onClick={() => setDesign((prev) => ({ ...prev, customColor: color }))}
                                className={`h-6 w-6 rounded-full border ${active ? 'ring-2 ring-primary-400 border-primary-500' : 'border-black/10 hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ) : (
                              <span key={`empty-${idx}`} className="h-6 w-6 rounded-full border border-dashed border-gray-300 bg-gray-50" />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Form Introduction</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-20"
                  placeholder="Short intro message shown above the public form"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Live Style Preview</h4>
            <div className="rounded-2xl border border-dashed border-gray-300 p-4 bg-gray-50">
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <p className="text-lg font-bold text-gray-900">{title || 'Your Form Title'}</p>
                <p className="text-sm text-gray-500 mt-1">{description || 'Your form intro will appear here.'}</p>
                <p className="text-xs text-gray-400 mt-1">Theme: {design.theme}</p>
                <div className="mt-4 h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-primary-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 bg-white flex-shrink-0">
        <button onClick={onCancel} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={() => {
            if (!title.trim()) { alert('Form title is required'); return; }
            if (fields.length === 0) { alert('Add at least one field'); return; }
            const metaField: FormBuilderField = {
              name: '__form_meta',
              label: 'Form Meta',
              type: '__design_meta',
              required: false,
              meta: {
                description: description.trim(),
                design,
                communication,
              },
            };
            onSubmit(title.trim(), [...fields, metaField]);
          }}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          {initialForm ? 'Update Form' : 'Create & Publish'}
        </button>
      </div>
    </div>
  );
}
