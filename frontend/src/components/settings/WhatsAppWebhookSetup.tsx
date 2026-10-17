import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function WhatsAppWebhookSetup() {
  const [status, setStatus] = useState<{ configured: boolean; lastReceivedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const url = `${window.location.origin}/api/v1/integrations/gupshup/webhook`;
  const input = 'w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';
  const button = 'rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600';
  const load = async () => {
    try { setStatus((await api.get('/whatsapp/webhook-config')).data); setError(''); }
    catch { setError('Could not load incoming WhatsApp setup. Try again.'); }
  };
  useEffect(() => { void load(); }, []);
  const generate = async () => {
    setBusy(true);
    try { setToken((await api.post('/whatsapp/webhook-config/token')).data.token); setConfirm(false); await load(); toast.success('Copy the new callback URL into Gupshup.'); }
    catch { toast.error('Could not generate the webhook token.'); }
    finally { setBusy(false); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied'); }
    catch { toast.error('Copy failed. Select and copy the value manually.'); }
  };
  return <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-600">
    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Receive customer replies</h4>
    <p className="text-sm text-gray-600 dark:text-gray-300">The callback must include a secret token. Saving only a callback URL or API key does not enable incoming replies.</p>
    <label className="block text-sm">Callback URL<input aria-label="WhatsApp callback URL" className={`${input} mt-1`} readOnly value={url} /></label>
    {error && <p role="alert" className="text-sm text-red-600">{error} <button className={button} onClick={() => void load()}>Try again</button></p>}
    {status && <>
      <p className="text-sm">Authentication: <strong>{status.configured ? 'Configured' : 'Not configured'}</strong></p>
      <p className="text-sm">Last incoming message: {status.lastReceivedAt ? new Date(status.lastReceivedAt).toLocaleString() : 'None recorded'}</p>
      {!confirm ? <button className={button} disabled={busy} onClick={() => status.configured ? setConfirm(true) : void generate()}>{busy ? 'Generating...' : status.configured ? 'Replace callback token' : 'Generate callback token'}</button>
        : <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"><p>This immediately replaces the current token, including a server-configured token. Update Gupshup with the new callback URL.</p><button className={button} disabled={busy} onClick={() => void generate()}>Replace token now</button> <button className={button} disabled={busy} onClick={() => setConfirm(false)}>Cancel</button></div>}
    </>}
    {token && <div className="space-y-2">
      <label className="block text-sm">Secret callback URL<input aria-label="WhatsApp secret callback URL" className={`${input} mt-1`} readOnly type="password" autoComplete="new-password" value={`${url}?token=${encodeURIComponent(token)}`} /></label>
      <button className={button} onClick={() => void copy(`${url}?token=${encodeURIComponent(token)}`)}>Copy secret callback URL</button>
      <p className="text-sm text-amber-700 dark:text-amber-300">Copy now and paste in Gupshup Console → Settings → Webhooks. This secret cannot be shown after leaving this tab. Keep it private.</p>
    </div>}
    <p className="text-xs text-gray-500 dark:text-gray-400">If your provider supports custom headers, use the callback URL with X-Webhook-Token instead. New senders without an assigned lead appear to admins; select an auto-create campaign below to assign them to salespeople.</p>
  </div>;
}
