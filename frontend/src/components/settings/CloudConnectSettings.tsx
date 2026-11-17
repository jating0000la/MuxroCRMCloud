import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { campaignService } from '../../services/campaigns';
import cloudconnectService, { CloudConnectConfig, CloudConnectEvent, CloudConnectPage, cloudconnectError } from '../../services/cloudconnect';
import { Campaign } from '../../types';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100';
const buttonClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700';
const initialConfig: CloudConnectConfig = { enabled: false, tenantId: '', crmCampaignId: '', inboundCampaignIds: [], operators: [], webhookTokenConfigured: false };

export default function CloudConnectSettings() {
  const [config, setConfig] = useState<CloudConnectConfig>(initialConfig);
  const [inboundIds, setInboundIds] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [events, setEvents] = useState<CloudConnectPage<CloudConnectEvent> | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const callbackUrl = `${window.location.origin}/api/v1/integrations/cloudconnect/webhook`;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [savedConfig, campaignList] = await Promise.all([cloudconnectService.getConfig(), campaignService.getAll()]);
      setConfig(savedConfig);
      setInboundIds(savedConfig.inboundCampaignIds.join('\n'));
      setCampaigns(campaignList);
    } catch (error) {
      setLoadError(cloudconnectError(error, 'Could not load IVR settings. Try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError('');
    try {
      setEvents(await cloudconnectService.getEvents(eventPage));
    } catch (error) {
      setEventsError(cloudconnectError(error, 'Could not load incoming call events.'));
    } finally {
      setEventsLoading(false);
    }
  }, [eventPage]);

  useEffect(() => { void loadConfig(); }, [loadConfig]);
  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed. Select and copy the value manually.');
    }
  };

  const save = async () => {
    const ids = [...new Set(inboundIds.split(/[\n,]/).map((id) => id.trim()).filter(Boolean))];
    const operators = config.operators.map((operator) => ({ agentId: operator.agentId.trim(), name: operator.name.trim() }));
    if (!/^\d{1,30}$/.test(config.tenantId.trim()) || ids.some((id) => !/^\d{1,30}$/.test(id))) {
      toast.error('Enter a numeric CloudConnect Tenant ID. Tenant and inbound campaign IDs must be at most 30 digits.');
      return;
    }
    if (!config.crmCampaignId) {
      toast.error('Choose a CRM campaign for IVR enquiries.');
      return;
    }
    if (ids.length > 100) {
      toast.error('Use no more than 100 inbound campaign IDs.');
      return;
    }
    if (operators.some((operator) => !operator.agentId || !operator.name)) {
      toast.error('Enter an Agent ID and name for each operator, or remove the empty row.');
      return;
    }
    if (new Set(operators.map((operator) => operator.agentId)).size !== operators.length) {
      toast.error('Each IVR operator must have a different Agent ID.');
      return;
    }
    if (operators.some((operator) => !/^\d{1,30}$/.test(operator.agentId))) {
      toast.error('IVR Agent IDs must contain numbers only, up to 30 digits.');
      return;
    }
    if (operators.length > 200) {
      toast.error('Use no more than 200 IVR operators.');
      return;
    }
    if (operators.some((operator) => operator.name.length > 100)) {
      toast.error('Operator names must be 100 characters or fewer.');
      return;
    }
    if (config.enabled && (!config.tenantId.trim() || !config.crmCampaignId || ids.length === 0 || !config.webhookTokenConfigured)) {
      toast.error('Choose a CRM campaign, enter tenant and inbound campaign IDs, and generate a webhook token before enabling.');
      return;
    }
    setSaving(true);
    try {
      const saved = await cloudconnectService.saveConfig({ enabled: config.enabled, tenantId: config.tenantId.trim(), crmCampaignId: config.crmCampaignId, inboundCampaignIds: ids, operators });
      setConfig(saved);
      setInboundIds(saved.inboundCampaignIds.join('\n'));
      toast.success('IVR settings saved');
    } catch (error) {
      toast.error(cloudconnectError(error, 'Could not save IVR settings.'));
    } finally {
      setSaving(false);
    }
  };

  const createCampaign = async () => {
    const existing = campaigns.find((campaign) => campaign.isActive && campaign.name.toLowerCase() === 'ivr enquiries');
    if (existing) {
      setConfig((current) => ({ ...current, crmCampaignId: existing.id }));
      toast.success('Selected the existing IVR Enquiries campaign');
      return;
    }
    setCreating(true);
    try {
      const campaign = await campaignService.create({ name: 'IVR Enquiries', description: 'Incoming enquiries from CloudConnect IVR' });
      setCampaigns((current) => [...current, campaign]);
      setConfig((current) => ({ ...current, crmCampaignId: campaign.id }));
      toast.success('Campaign created. Add salespeople on the Campaigns page before enabling IVR.');
    } catch (error) {
      toast.error(cloudconnectError(error, 'Could not create the IVR campaign.'));
    } finally {
      setCreating(false);
    }
  };

  const generateToken = async () => {
    setGenerating(true);
    try {
      const { token } = await cloudconnectService.generateWebhookToken();
      setNewToken(token);
      setShowToken(false);
      setConfirmRotate(false);
      setConfig((current) => ({ ...current, webhookTokenConfigured: true }));
      toast.success('Webhook token generated. Copy it before leaving this page.');
    } catch (error) {
      toast.error(cloudconnectError(error, 'Could not generate a webhook token.'));
    } finally {
      setGenerating(false);
    }
  };

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      await cloudconnectService.retryEvent(id);
      toast.success('Event queued for another attempt');
      await loadEvents();
    } catch (error) {
      toast.error(cloudconnectError(error, 'Could not retry this event.'));
    } finally {
      setRetrying(null);
    }
  };

  if (loading) return <p className="py-8 text-center text-gray-500">Loading IVR settings...</p>;
  if (loadError) return <div className="space-y-3"><p role="alert" className="text-red-600 dark:text-red-400">{loadError}</p><button className={buttonClass} onClick={() => void loadConfig()}>Try again</button></div>;

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div>
        <h2 className="text-lg font-semibold">CloudConnect IVR</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Incoming calls create enquiries in one CRM campaign. Reception operators answer calls; CRM salespeople own and follow up enquiries.</p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-600">
        <h3 className="font-semibold">1. Choose the enquiry campaign</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 text-sm font-medium"><label htmlFor="cloudconnect-crm-campaign">CRM campaign</label>
            <select id="cloudconnect-crm-campaign" className={`${inputClass} mt-1`} value={config.crmCampaignId} onChange={(event) => setConfig({ ...config, crmCampaignId: event.target.value })}>
              <option value="">Select a campaign</option>
              {campaigns.filter((campaign) => campaign.isActive || campaign.id === config.crmCampaignId).map((campaign) => <option key={campaign.id} value={campaign.id} disabled={!campaign.isActive}>{campaign.name}{!campaign.isActive ? ' (inactive)' : ''}</option>)}
            </select>
          </div>
          <button className={buttonClass} onClick={() => void createCampaign()} disabled={creating}>{creating ? 'Creating...' : 'Create IVR Enquiries'}</button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Add active salespeople to this campaign on the <Link className="text-primary-600 underline dark:text-primary-400" to="/campaigns">Campaigns page</Link> before enabling. New callers are assigned round-robin; repeat calls keep their existing salesperson.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">CloudConnect Tenant ID
            <input className={`${inputClass} mt-1`} value={config.tenantId} onChange={(event) => setConfig({ ...config, tenantId: event.target.value })} inputMode="numeric" maxLength={30} autoComplete="off" />
          </label>
          <label className="text-sm font-medium">CloudConnect inbound campaign IDs
            <textarea className={`${inputClass} mt-1`} value={inboundIds} onChange={(event) => setInboundIds(event.target.value)} rows={3} placeholder="One numeric ID per line, or separated by commas" />
            <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Use the IDs supplied by CloudConnect, which differ from the CRM campaign ID.</span>
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-600">
        <h3 className="font-semibold">2. Name your incoming call operators</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Optional: map IVR Agent IDs to operator names for call history. These operators do not need a CRM account, and sales users do not need an IVR Agent ID.</p>
        {config.operators.map((operator, index) => (
          <div className="flex flex-wrap gap-2" key={index}>
            <label className="min-w-0 flex-1 text-sm">Agent ID
              <input className={`${inputClass} mt-1`} inputMode="numeric" maxLength={30} value={operator.agentId} onChange={(event) => setConfig({ ...config, operators: config.operators.map((item, itemIndex) => itemIndex === index ? { ...item, agentId: event.target.value } : item) })} />
            </label>
            <label className="min-w-0 flex-1 text-sm">Operator name
              <input className={`${inputClass} mt-1`} maxLength={100} value={operator.name} onChange={(event) => setConfig({ ...config, operators: config.operators.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} />
            </label>
            <button className={`${buttonClass} self-end`} aria-label={`Remove operator ${index + 1}`} onClick={() => setConfig({ ...config, operators: config.operators.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
          </div>
        ))}
        <button className={buttonClass} disabled={config.operators.length >= 200} onClick={() => setConfig({ ...config, operators: [...config.operators, { agentId: '', name: '' }] })}>Add operator</button>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-600">
        <h3 className="font-semibold">3. Connect incoming call events</h3>
        <label className="block text-sm font-medium">Webhook URL
          <div className="mt-1 flex gap-2"><input className={`${inputClass} min-w-0 text-sm`} value={callbackUrl} readOnly /><button className={buttonClass} onClick={() => void copy(callbackUrl)}>Copy</button></div>
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400">Give CloudConnect this URL for Ringing, Answered and Hangup events, plus the secret below as the <code>X-CloudConnect-Token</code> header. If custom headers are unavailable, copy the URL with the secret instead.</p>
        <p className="text-sm">Webhook token: <span className="font-medium">{config.webhookTokenConfigured ? 'Configured' : 'Not generated'}</span></p>
        {!confirmRotate ? (
          <button className={buttonClass} disabled={generating} onClick={() => config.webhookTokenConfigured ? setConfirmRotate(true) : void generateToken()}>{generating ? 'Generating...' : config.webhookTokenConfigured ? 'Replace webhook token' : 'Generate webhook token'}</button>
        ) : (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <p>Replacing the token immediately stops callbacks using the old token. Update CloudConnect with the new value.</p>
            <div className="mt-2 flex gap-2"><button className={buttonClass} disabled={generating} onClick={() => void generateToken()}>{generating ? 'Generating...' : 'Replace token now'}</button><button className={buttonClass} disabled={generating} onClick={() => setConfirmRotate(false)}>Cancel</button></div>
          </div>
        )}
        {newToken && (
          <div className="space-y-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <p>Copy this secret now; it cannot be shown again after leaving this page. Share it privately with CloudConnect. A URL containing this token is also a secret.</p>
            <label className="block font-medium">New webhook token
              <div className="mt-1 flex gap-2"><input className={`${inputClass} min-w-0 font-mono text-xs`} type={showToken ? 'text' : 'password'} autoComplete="new-password" readOnly value={newToken} /><button className={buttonClass} onClick={() => setShowToken(!showToken)}>{showToken ? 'Hide' : 'Show'}</button><button className={buttonClass} onClick={() => void copy(newToken)}>Copy</button></div>
            </label>
            <button className={buttonClass} onClick={() => void copy(`${callbackUrl}?token=${encodeURIComponent(newToken)}`)}>Copy URL with secret</button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-600">
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={config.enabled} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /><span className="font-medium">Enable incoming IVR enquiries<span className="mt-1 block font-normal text-gray-500 dark:text-gray-400">Only approved incoming calls create enquiries. Sales follow-ups remain in CRM.</span></span></label>
        <button className="shrink-0 rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save IVR settings'}</button>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-600">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Incoming event activity</h3><button className={buttonClass} onClick={() => void loadEvents()} disabled={eventsLoading}>{eventsLoading ? 'Loading...' : 'Refresh'}</button></div>
        {eventsError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{eventsError}</p>}
        {!eventsError && events && events.data.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No incoming events received yet.</p>}
        {events && events.data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b dark:border-gray-700"><th className="p-2">Received</th><th className="p-2">Call ID</th><th className="p-2">Status</th><th className="p-2">Attempts</th><th className="p-2">Details</th></tr></thead><tbody>{events.data.map((event) => <tr className="border-b last:border-0 dark:border-gray-700" key={event.id}><td className="whitespace-nowrap p-2">{new Date(event.createdAt).toLocaleString()}</td><td className="max-w-48 break-all p-2 font-mono text-xs">{event.externalCallId}</td><td className={`p-2 ${event.status === 'failed' ? 'text-red-600 dark:text-red-400' : event.status === 'processed' ? 'text-green-700 dark:text-green-400' : ''}`}>{event.status}</td><td className="p-2">{event.attempts}</td><td className="max-w-xs p-2">{event.error && <p className="mb-2 break-words text-xs text-red-600 dark:text-red-400">{event.error}</p>}{event.status === 'failed' && <button className={buttonClass} disabled={retrying !== null} onClick={() => void retry(event.id)}>{retrying === event.id ? 'Retrying...' : 'Retry'}</button>}</td></tr>)}</tbody></table></div>}
        {events && events.pagination.totalPages > 1 && <div className="flex items-center justify-between gap-2 text-sm"><button className={buttonClass} disabled={eventPage === 1 || eventsLoading} onClick={() => setEventPage(eventPage - 1)}>Previous</button><span>Page {events.pagination.page} of {events.pagination.totalPages}</span><button className={buttonClass} disabled={eventPage >= events.pagination.totalPages || eventsLoading} onClick={() => setEventPage(eventPage + 1)}>Next</button></div>}
      </div>
    </div>
  );
}
