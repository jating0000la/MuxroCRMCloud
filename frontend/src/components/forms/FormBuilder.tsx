import React, { useState, useRef, useCallback, useEffect } from 'react';

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
}

interface InitialForm {
  id: string;
  title: string;
  fields: FormBuilderField[];
}

interface FormBuilderProps {
  initialForm?: InitialForm;
  onSubmit: (title: string, fields: FormBuilderField[], whatsappConfig?: any, emailConfig?: any) => void;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short answer', icon: 'T' },
  { value: 'textarea', label: 'Paragraph', icon: '¶' },
  { value: 'radio', label: 'Multiple choice', icon: '◉' },
  { value: 'checkbox', label: 'Checkboxes', icon: '☑' },
  { value: 'select', label: 'Drop-down', icon: '▾' },
  { value: 'file', label: 'File upload', icon: '↑' },
  { value: 'linear_scale', label: 'Linear scale', icon: '─' },
  { value: 'rating', label: 'Rating', icon: '★' },
  { value: 'multiple_choice_grid', label: 'Choice grid', icon: '⊞' },
  { value: 'checkbox_grid', label: 'Tick box grid', icon: '⊠' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'time', label: 'Time', icon: '◷' },
];

export default function FormBuilder({ initialForm, onSubmit, onCancel }: FormBuilderProps) {
  const [title, setTitle] = useState(initialForm?.title || '');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormBuilderField[]>(initialForm?.fields || [
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', type: 'text', required: false },
    { name: 'phone', label: 'Phone Number', type: 'text', required: false },
  ]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [builderTab, setBuilderTab] = useState<'fields' | 'communication'>('fields');

  // Communication config
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const whatsappPhoneRef = useRef<HTMLInputElement>(null);
  const whatsappMessageRef = useRef<HTMLTextAreaElement>(null);
  const emailRecipientRef = useRef<HTMLInputElement>(null);
  const emailSubjectRef = useRef<HTMLInputElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);

  const insertTagAtCursor = useCallback(
    (
      ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
      currentValue: string,
      setter: (v: string) => void,
      tag: string
    ) => {
      const el = ref.current;
      const placeholder = `{{${tag}}}`;
      if (el) {
        const start = el.selectionStart ?? currentValue.length;
        const end = el.selectionEnd ?? currentValue.length;
        const newVal = currentValue.slice(0, start) + placeholder + currentValue.slice(end);
        setter(newVal);
        requestAnimationFrame(() => {
          const pos = start + placeholder.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        });
      } else {
        setter(currentValue + placeholder);
      }
    },
    []
  );

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
      case 'file':
        return <input type="file" disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50" />;
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
        /* Communication Tab */
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-8">
          {fields.length > 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">Click tags below each field to insert placeholders</p>
              <p className="text-blue-600 text-xs">The user's submitted value will replace the tag.</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-800">Add form fields first</p>
              <p className="text-amber-600 text-xs">Switch to "Form Fields" tab to add fields.</p>
            </div>
          )}

          {/* WhatsApp */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={whatsappEnabled} onChange={(e) => setWhatsappEnabled(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
              <span className="text-sm font-semibold text-gray-900">💬 Enable WhatsApp Integration</span>
            </label>
            {whatsappEnabled && (
              <div className="ml-6 space-y-4 border-l-2 border-green-200 pl-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input ref={whatsappPhoneRef} placeholder="e.g. 919876543210" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
                  <p className="text-xs text-gray-400 mt-1">Country code + number, no + or spaces</p>
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {fields.map((f) => (
                        <button key={f.label} type="button" onClick={() => insertTagAtCursor(whatsappPhoneRef, whatsappPhone, setWhatsappPhone, f.label)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 transition cursor-pointer">
                          + {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {fields.map((f) => (
                        <button key={f.label} type="button" onClick={() => insertTagAtCursor(whatsappMessageRef, whatsappMessage, setWhatsappMessage, f.label)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 transition cursor-pointer">
                          + {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea ref={whatsappMessageRef} className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[120px] resize-y focus:ring-2 focus:ring-green-500"
                    placeholder={"Hello! New form submission:\n\nName: ...\nEmail: ...\n\nThank you!"}
                    value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm font-semibold text-gray-900">✉ Enable Email Integration</span>
            </label>
            {emailEnabled && (
              <div className="ml-6 space-y-4 border-l-2 border-blue-200 pl-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                  <input ref={emailRecipientRef} placeholder="e.g. admin@example.com" value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {fields.map((f) => (
                        <button key={f.label} type="button" onClick={() => insertTagAtCursor(emailRecipientRef, emailRecipient, setEmailRecipient, f.label)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition cursor-pointer">
                          + {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input ref={emailSubjectRef} placeholder="e.g. New Form Submission" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {fields.map((f) => (
                        <button key={f.label} type="button" onClick={() => insertTagAtCursor(emailSubjectRef, emailSubject, setEmailSubject, f.label)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition cursor-pointer">
                          + {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body Template</label>
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {fields.map((f) => (
                        <button key={f.label} type="button" onClick={() => insertTagAtCursor(emailBodyRef, emailBody, setEmailBody, f.label)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition cursor-pointer">
                          + {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea ref={emailBodyRef} className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[120px] resize-y focus:ring-2 focus:ring-blue-500"
                    placeholder={"Hello,\n\nNew submission received:\n\nRegards"}
                    value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                </div>
              </div>
            )}
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
            const wc = whatsappEnabled && whatsappPhone.trim() && whatsappMessage.trim()
              ? { enabled: true, phoneNumber: whatsappPhone.trim(), messageTemplate: whatsappMessage.trim() }
              : { enabled: false, phoneNumber: '', messageTemplate: '' };
            const ec = emailEnabled && emailRecipient.trim() && emailSubject.trim() && emailBody.trim()
              ? { enabled: true, recipientEmail: emailRecipient.trim(), subject: emailSubject.trim(), bodyTemplate: emailBody.trim() }
              : { enabled: false, recipientEmail: '', subject: '', bodyTemplate: '' };
            onSubmit(title.trim(), fields, wc, ec);
          }}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          {initialForm ? 'Update Form' : 'Create & Publish'}
        </button>
      </div>
    </div>
  );
}
