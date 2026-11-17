import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { leadService, type LeadUpdate } from '../../services/leads';
import type { Lead } from '../../types';

const fields = [
  { name: 'name', label: 'Name', type: 'text', maxLength: 255 },
  { name: 'email', label: 'Email', type: 'email', maxLength: 255 },
  { name: 'phone', label: 'Phone', type: 'tel', maxLength: 50 },
] as const;

interface Props {
  lead: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}

export default function EditLeadDialog({ lead, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    if (!name) {
      setError('Enter a lead name.');
      return;
    }

    const changes: LeadUpdate = {};
    if (name !== lead.name.trim()) changes.name = name;
    if (email !== (lead.email ?? '').trim()) {
      const input = form.elements.namedItem('email') as HTMLInputElement;
      if (!input.validity.valid) {
        setError('Enter a valid email address.');
        input.focus();
        return;
      }
      changes.email = email || null;
    }
    if (phone !== (lead.phone ?? '').trim()) changes.phone = phone || null;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setError('');
    setSaving(true);
    try {
      const updated = await leadService.update(lead.id, changes);
      toast.success('Lead updated');
      onSaved(updated);
    } catch (err) {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Failed to update lead. Please try again.');
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-lead-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-800 dark:text-gray-100"
    >
      <h2 id="edit-lead-title" className="text-lg font-semibold">Edit lead</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        {fields.map(({ name, label, type, maxLength }) => (
          <label key={name} className="block text-sm font-medium">
            {label}
            <input
              name={name}
              type={type}
              required={name === 'name'}
              maxLength={maxLength}
              defaultValue={lead[name] ?? ''}
              disabled={saving}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
        ))}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
