import React, { useState, useMemo } from 'react';

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

    return {
      title: initialForm?.title || '',
      description: metaField?.meta?.description || '',
      design: safeDesign,
      fields: sourceFields.filter((f) => f.type !== '__design_meta' && f.name !== '__form_meta'),
    };
  }, [initialForm]);

  const [title, setTitle] = useState(initialConfig.title);
  const [description, setDescription] = useState(initialConfig.description);
  const [fields, setFields] = useState<FormBuilderField[]>(initialConfig.fields.length > 0 ? initialConfig.fields : DEFAULT_FIELDS);
  const [design, setDesign] = useState<FormDesign>(initialConfig.design);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [builderTab, setBuilderTab] = useState<'fields' | 'design'>('fields');
  const [customColorSlots, setCustomColorSlots] = useState<string[]>(EMPTY_CUSTOM_SLOTS);

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
