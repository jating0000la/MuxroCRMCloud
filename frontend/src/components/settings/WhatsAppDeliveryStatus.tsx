import { useEffect, useState } from 'react';
import api from '../../services/api';
import { templateError } from '../../services/gupshupTemplates';

interface DeliveryStatus {
  senderRunning: boolean;
  pending: number;
  pendingError: string | null;
  queue: { queuedCount: number; activeCount: number; failedCount: number } | null;
  attempts: { id: string; status: string; templateId: string; error: string | null; createdAt: string }[];
}

export default function WhatsAppDeliveryStatus() {
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await api.get<DeliveryStatus>('/integrations/gupshup/templates/delivery');
        if (active) { setStatus(response.data); setError(''); }
      } catch (error) { if (active) setError(templateError(error, 'Could not load WhatsApp delivery status')); }
    };
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);

  return <div className="space-y-3 rounded-lg border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100">Automatic WhatsApp delivery</h4>
      <button type="button" onClick={() => setRefresh(v => v + 1)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">Refresh delivery status</button>
    </div>
    {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
    {!status && !error && <p>Loading delivery status...</p>}
    {status && <>
      <p>Automatic sender: <strong>{status.senderRunning ? 'Running' : 'Not running'}</strong></p>
      <p>Waiting: {status.pending + (status.queue?.queuedCount || 0)} · Processing: {status.queue?.activeCount || 0} · Failed jobs: {status.queue?.failedCount || 0}</p>
      {status.pendingError && <p role="alert" className="text-amber-700 dark:text-amber-300">{status.pendingError}</p>}
      {status.attempts.length === 0 ? <p>No automatic sending attempts recorded yet.</p> : <ul className="space-y-2">
        {status.attempts.map(attempt => <li key={attempt.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <p className="break-words font-medium">{attempt.status === 'completed' ? 'Accepted by Gupshup' : attempt.status === 'failed' ? 'Failed attempt' : 'Sending'} · {attempt.templateId}</p>
          <p className="text-xs text-gray-500">{new Date(attempt.createdAt).toLocaleString()}</p>
          {attempt.error && <p className="mt-1 break-words text-red-600 dark:text-red-400">{attempt.error}</p>}
        </li>)}
      </ul>}
      <p className="text-xs text-gray-500 dark:text-gray-400">Form submissions and configured follow-up templates are processed while the API is running. Gupshup acceptance is followed by delivery updates in WhatsApp chat.</p>
    </>}
  </div>;
}
