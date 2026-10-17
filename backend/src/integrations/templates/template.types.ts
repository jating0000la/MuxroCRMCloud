export type TemplateHeader = 'text' | 'image' | 'video' | 'document';
export interface TemplateButton { type: string; text: string; url?: string; phoneNumber?: string; }
export interface ApprovedTemplate {
  id: string; appId: string; name: string; language: string; status: string; category: string;
  body: string; headerType: TemplateHeader; mediaUrl: string; mediaId: string; parameterFormat: string;
  parameterCount: number; buttons: TemplateButton[]; supported: boolean; unsupportedReason?: string;
  containerMeta: Record<string, any>; providerMetadata: Record<string, any>;
}
export interface TemplateMessageConfig {
  templateId: string; params: string[]; mediaUrl?: string; recipientField?: string;
}
export interface TemplateDelivery {
  phone: string; templateId: string; params: string[]; mediaUrl?: string;
  leadId: string; campaignId: string; automationKey: string;
}
export function normalizeTemplate(t: any, appId: string): ApprovedTemplate {
  let meta = t.containerMeta || {};
  if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) meta = {};
  const components = Array.isArray(t.components) ? t.components : Array.isArray(meta.components) ? meta.components : [];
  const header = components.find((c: any) => String(c.type).toUpperCase() === 'HEADER');
  const body = String(t.data || t.body || components.find((c: any) => String(c.type).toUpperCase() === 'BODY')?.text || '');
  const rawType = String(header?.format || t.templateType || t.type || 'TEXT').toLowerCase();
  const headerType = (rawType === 'file' ? 'document' : rawType) as TemplateHeader;
  const rawButtons = meta.buttons || components.find((c: any) => String(c.type).toUpperCase() === 'BUTTONS')?.buttons || [];
  const buttons = (Array.isArray(rawButtons) ? rawButtons : []).map((b: any) => ({
    type: String(b.type || '').toUpperCase(), text: String(b.text || b.title || ''),
    ...(b.url ? { url: String(b.url) } : {}), ...(b.phone_number || b.phoneNumber ? { phoneNumber: String(b.phone_number || b.phoneNumber) } : {}),
  }));
  const texts = [body, header?.text || ''].join('\n');
  const placeholders = [...texts.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m => m[1]);
  const numeric = placeholders.filter(p => /^\d+$/.test(p)).map(Number);
  const parameterCount = numeric.length ? Math.max(...numeric) : 0;
  let reason = '';
  if (!['text', 'image', 'video', 'document'].includes(headerType)) reason = 'This template header type is not supported by this sender.';
  if (placeholders.some(p => !/^\d+$/.test(p)) || parameterCount > 50) reason = 'This sender requires positional variables such as {{1}} and {{2}} (up to 50).';
  if (String(t.parameterFormat).toUpperCase() === 'NAMED') reason = 'Named template variables require a provider-specific mapping. Use positional variables.';
  if (/\{\{/.test(header?.text || '')) reason = 'Dynamic text headers require separate provider parameter mapping. Use a fixed text or media header.';
  if (components.some((c: any) => ['CAROUSEL', 'PRODUCT', 'PRODUCT_LIST', 'LIMITED_TIME_OFFER'].includes(String(c.type).toUpperCase())) || Array.isArray(meta.cards)) reason = 'This template format requires a provider-specific payload mapping.';
  if (buttons.some(b => b.url?.includes('{{'))) reason = 'Dynamic URL button variables require a provider-specific mapping. Use a template with static buttons.';
  return { id: String(t.id || t.templateId || ''), appId, name: String(t.elementName || t.name || t.templateName || t.id || ''),
    language: String(t.languageCode || t.language || ''), status: String(t.status || t.state || '').toUpperCase(), category: String(t.category || ''),
    body, headerType, mediaUrl: typeof meta.mediaUrl === 'string' ? meta.mediaUrl : '', mediaId: String(meta.mediaId || ''),
    parameterFormat: String(t.parameterFormat || 'POSITIONAL'), parameterCount, buttons, supported: !reason,
    ...(reason ? { unsupportedReason: reason } : {}), containerMeta: meta, providerMetadata: t };
}
export function resolveTemplateValue(pattern: string, values: Record<string, any>): string {
  return pattern.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, field: string) => {
    const value = Object.prototype.hasOwnProperty.call(values, field) ? values[field] : '';
    if (Array.isArray(value)) return value.filter(v => ['string', 'number', 'boolean'].includes(typeof v)).join(', ');
    return ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : '';
  });
}
