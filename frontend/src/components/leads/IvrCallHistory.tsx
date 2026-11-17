import { useEffect, useState } from 'react';
import cloudconnectService, { CloudConnectCall, CloudConnectPage, cloudconnectError } from '../../services/cloudconnect';

export default function IvrCallHistory({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<CloudConnectPage<CloudConnectCall> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    cloudconnectService.getCalls(leadId, page).then((result) => {
      if (!cancelled) setCalls(result);
    }).catch((failure) => {
      if (!cancelled) setError(cloudconnectError(failure, 'Could not load IVR call history.'));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leadId, page, refresh]);

  const buttonClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700';

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Incoming IVR calls</h3><button className={buttonClass} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</button></div>
      <p className="text-sm text-gray-500 dark:text-gray-400">The IVR operator is separate from the CRM salesperson assigned to this enquiry. A callback flag means no Answered event has been received yet; it clears if that event arrives later.</p>
      {loading && <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">Loading calls...</p>}
      {error && <div role="alert" className="space-y-2 text-sm text-red-600 dark:text-red-400"><p>{error}</p><button className={buttonClass} onClick={() => setRefresh((value) => value + 1)}>Try again</button></div>}
      {!loading && !error && calls?.data.length === 0 && <p className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">No IVR calls recorded for this enquiry.</p>}
      {!loading && !error && calls?.data.map((call) => (
        <div key={call.id} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{new Date(call.receivedAt).toLocaleString()}</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${call.callbackNeeded ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : call.answered ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>{call.callbackNeeded ? 'Callback needed' : call.status === 'ended' ? call.answered ? 'Answered · ended' : 'Ended · answer unconfirmed' : call.status === 'answered' ? 'Answered' : 'Ringing'}</span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">Caller</dt><dd className="mt-1 text-gray-900 dark:text-gray-100">{call.phone}</dd></div>
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">IVR operator</dt><dd className="mt-1 text-gray-900 dark:text-gray-100">{call.operatorName || (call.agentId ? `Agent ${call.agentId}` : 'Not recorded')}{call.operatorName && call.agentId ? <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({call.agentId})</span> : null}</dd></div>
            {call.endedAt && <div><dt className="text-xs text-gray-500 dark:text-gray-400">Call ended</dt><dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(call.endedAt).toLocaleString()}</dd></div>}
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">Call reference</dt><dd className="mt-1 break-all font-mono text-xs text-gray-700 dark:text-gray-300">{call.externalCallId}</dd></div>
          </dl>
        </div>
      ))}
      {!error && calls && calls.pagination.totalPages > 1 && <div className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300"><button className={buttonClass} disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {calls.pagination.page} of {calls.pagination.totalPages}</span><button className={buttonClass} disabled={loading || page >= calls.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}
