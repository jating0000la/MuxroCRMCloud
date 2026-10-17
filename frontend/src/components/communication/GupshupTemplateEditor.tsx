import { useEffect, useState } from 'react';
import { gupshupTemplates, GupshupTemplate, TemplateMessageConfig, templateError } from '../../services/gupshupTemplates';

interface Props {
  value: TemplateMessageConfig | null;
  onChange: (value: TemplateMessageConfig | null) => void;
  fields: { tag: string; label: string }[];
  recipient?: boolean;
  catalogOnly?: boolean;
}
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
export default function GupshupTemplateEditor({ value, onChange, fields, recipient = false, catalogOnly = false }: Props) {
  const [templates, setTemplates] = useState<GupshupTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    gupshupTemplates.list().then(result => { if (active) { setTemplates(result.templates); setSyncedAt(result.syncedAt); } })
      .catch(error => { if (active) setError(templateError(error, 'Could not load templates')); });
    return () => { active = false; };
  }, []);
  const sync = async () => {
    setBusy(true); setError('');
    try {
      const result = await gupshupTemplates.sync();
      if (!result.success) throw new Error(result.error || 'Template synchronization failed');
      setTemplates(result.templates); setSyncedAt(new Date().toISOString());
    } catch (error) { setError(templateError(error, 'Could not sync Gupshup templates')); }
    finally { setBusy(false); }
  };
  const selected = templates.find(t => t.id === value?.templateId);
  const update = (patch: Partial<TemplateMessageConfig>) => onChange({ templateId: '', params: [], ...value, ...patch });
  const choose = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) { onChange(null); return; }
    onChange({ templateId: id, params: Array.from({ length: template.parameterCount }, (_, i) => i === 0 && fields.some(f => f.tag === 'name') ? '{{name}}' : ''),
      mediaUrl: template.mediaUrl || '', ...(recipient ? { recipientField: value?.recipientField || (fields.some(f => f.tag === 'phone') ? 'phone' : fields[0]?.tag || '') } : {}) });
  };
  const sample = (value: string) => value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, field) => `[${fields.find(f => f.tag === field)?.label || field}]`);
  const mediaUrl = value?.mediaUrl || selected?.mediaUrl || '';
  const safePreview = /^https?:\/\//i.test(mediaUrl) && !mediaUrl.includes('{{');
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Approved Gupshup templates</h4><p className="text-xs text-gray-500 dark:text-gray-400">{syncedAt ? `Last synced ${new Date(syncedAt).toLocaleString()}` : 'Configure the Gupshup API key and App ID in Communication Setup, then sync.'}</p></div>
      <button type="button" onClick={() => void sync()} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">{busy ? 'Syncing...' : 'Sync Gupshup templates'}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {catalogOnly ? <div className="space-y-2 text-sm">{templates.length === 0 ? <p className="text-gray-500">No synced templates yet.</p> : templates.map(t => <div key={t.id} className="rounded-lg border p-3 dark:border-gray-600"><p className="font-medium dark:text-gray-100">{t.name} · {t.language} <span className="text-xs">{t.status}</span></p><p className="whitespace-pre-wrap text-xs text-gray-500">{t.body}</p><p className="mt-1 text-xs text-gray-500">{t.headerType} · {t.parameterCount} variable(s) · {t.buttons.length} button(s)</p>{!t.supported && <p className="text-xs text-amber-700">{t.unsupportedReason}</p>}</div>)}</div> : <>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp template
        <select aria-label="WhatsApp template" className={`${input} mt-1`} value={value?.templateId || ''} onChange={e => choose(e.target.value)}>
          <option value="">Select an approved template</option>
          {value?.templateId && !selected && <option value={value.templateId} disabled>Previously selected template — sync to verify</option>}
          {templates.map(t => <option key={t.id} value={t.id} disabled={t.status !== 'APPROVED' || !t.supported}>{t.name} · {t.language} · {t.headerType}{t.status !== 'APPROVED' ? ` (${t.status})` : !t.supported ? ' (unsupported)' : ''}</option>)}
        </select>
      </label>
      {value?.templateId && !selected && <p role="alert" className="text-sm text-amber-700">Sync and select a currently approved template before saving.</p>}
      {selected && <>
        {recipient && <label className="block text-sm text-gray-700 dark:text-gray-300">Recipient phone field<select aria-label="Recipient phone field" className={`${input} mt-1`} value={value?.recipientField || 'phone'} onChange={e => update({ recipientField: e.target.value })}>{fields.map(f => <option key={f.tag} value={f.tag}>{f.label}</option>)}</select></label>}
        {Array.from({ length: selected.parameterCount }, (_, index) => <div key={index} className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">{`Variable {{${index + 1}}} — form field`}<select aria-label={`Variable {{${index + 1}}} — form field`} className={`${input} mt-1`} value={fields.some(f => value?.params[index] === `{{${f.tag}}}`) ? value?.params[index] : ''} onChange={e => update({ params: Array.from({ length: selected.parameterCount }, (_, i) => i === index ? e.target.value : value?.params[i] || '') })}><option value="">Custom text</option>{fields.map(f => <option key={f.tag} value={`{{${f.tag}}}`}>{f.label}</option>)}</select></label>
          <label className="text-sm text-gray-700 dark:text-gray-300">{`Value for variable ${index + 1}`}<input aria-label={`Value for variable ${index + 1}`} className={`${input} mt-1`} value={value?.params[index] || ''} placeholder="e.g. {{name}} or a fixed value" onChange={e => update({ params: Array.from({ length: selected.parameterCount }, (_, i) => i === index ? e.target.value : value?.params[i] || '') })} /></label>
        </div>)}
        {selected.headerType !== 'text' && <label className="block text-sm text-gray-700 dark:text-gray-300">{selected.headerType === 'image' ? 'Template image URL' : selected.headerType === 'video' ? 'Template video URL' : 'Template document URL'}<input className={`${input} mt-1`} value={value?.mediaUrl || ''} placeholder="https://... or {{public_file_url}}" onChange={e => update({ mediaUrl: e.target.value })} /><span className="mt-1 block text-xs text-gray-500">Use a public URL that Gupshup can download. Uploaded form files stored as data URLs cannot be used here.</span></label>}
        <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xs font-semibold uppercase text-green-800 dark:text-green-300">Template preview</p>
          {selected.headerType === 'image' && safePreview && <img src={mediaUrl} alt="Template header preview" className="max-h-48 max-w-full rounded-lg object-contain" />}
          {['document', 'video'].includes(selected.headerType) && <p className="text-xs text-gray-600">{selected.headerType} header: {sample(mediaUrl)}</p>}
          <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">{selected.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => sample(value?.params[Number(n) - 1] || `[Variable ${n}]`))}</p>
          {selected.buttons.length > 0 && <div className="space-y-1">{selected.buttons.map((button, index) => <div key={index} className="rounded-lg border border-green-200 bg-white p-2 text-center text-sm text-blue-600 dark:bg-gray-800">{button.text}</div>)}</div>}
          <p className="text-xs text-gray-500 dark:text-gray-400">Gupshup sends the approved template, including its fixed buttons. Form answers fill the variables above.</p>
        </div>
      </>}
    </>}
  </div>;
}
