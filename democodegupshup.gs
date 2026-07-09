/**
 * Gupshup Official WhatsApp API Manager
 * Google Apps Script + Google Sheets database
 *
 * Files required:
 * - Code.gs
 * - index.html
 * - settings.html
 * - inbox.html
 * - send.html
 * - templates.html
 * - broadcast.html
 * - contacts.html
 * - bot.html
 * - logs.html
 * - reports.html
 *
 * IMPORTANT:
 * Keep GUPSHUP_API_KEY in Script Properties, not directly in this file.
 */

const PROP = PropertiesService.getScriptProperties();

const REQUIRED_SHEETS = {
  Settings: ['key', 'value', 'notes', 'updated_at'],
  Messages: ['timestamp','phone','name','direction','message','type','media_url','msgId','status','raw'],
  Contacts: ['phone','name','segment','tags','opt_in','last_seen','source','notes'],
  'Client Database': ['phone','name','tags','notes'],
  'Staff Database': ['phone','name','role','active'],
  Unsubscribe: ['phone','reason','time'],
  DND: ['phone','reason','time'],
  Templates: ['local_name','template_id','language','category','type','body','params','media_type','media_url','status','updated_at'],
  Bot: ['keyword','new_reply','new_title','new_buttons','staff_reply','staff_title','staff_buttons','client_reply','client_title','client_buttons'],
  History: ['time','role','phone','incoming_text','reply_text','status'],
  Broadcasts: ['id','name','type','template_id','message','audience','params_map','status','created_at'],
  Data: ['phone','name','col3','document','col5','col6','col7','col8','col9','col10','status'],
  Template: ['key','value'],
  logs: ['time','name','phone','message','raw'],
  api_logs: ['time','to','type','status','messageId','response']
};

const EDITABLE_SHEETS = [
  'Contacts',
  'Client Database',
  'Staff Database',
  'Unsubscribe',
  'DND',
  'Templates',
  'Bot',
  'Broadcasts',
  'Data',
  'Template'
];

function doGet(e) {
  const page = ((e && e.parameter && e.parameter.page) || 'index').replace(/[^a-zA-Z0-9_-]/g, '');
  const allowed = ['index','settings','inbox','inbox2','send','templates','broadcast','contacts','bot','logs','reports'];
  const file = allowed.indexOf(page) >= 0 ? page : 'index';
  const t = HtmlService.createTemplateFromFile(file);
  t.page = file;
  return t.evaluate()
    .setTitle('Gupshup WhatsApp API Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Gupshup Tools')
    .addItem('Setup Sheets', 'setupSheetConfig')
    .addItem('Open Web App URL', 'showWebAppUrl')
    .addToUi();

  ui.createMenu('Bulk WhatsApp')
    .addItem('Send Pending Batch', 'sendPendingBatchFromSheet')
    .addItem('Set 10 min Trigger', 'createTrigger')
    .addItem('Remove Trigger', 'removeTrigger')
    .addToUi();
}

function showWebAppUrl() {
  SpreadsheetApp.getUi().alert(getWebAppUrl() || 'Deploy the script as a Web App first, then reopen this menu.');
}

function getWebAppUrl() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

function getPageUrl(page) {
  const base = getWebAppUrl();
  return base ? base + '?page=' + encodeURIComponent(page) : '?page=' + encodeURIComponent(page);
}

function getConfig_() {
  return {
    apiKey: PROP.getProperty('GUPSHUP_API_KEY') || '',
    source: PROP.getProperty('GUPSHUP_SOURCE') || PROP.getProperty('GUPSHUP_SOURCE_NUMBER') || '919717714796',
    appName: PROP.getProperty('GUPSHUP_APP_NAME') || 'MuxroWorkshop',
    appId: PROP.getProperty('GUPSHUP_APP_ID') || '',
    sheetId: PROP.getProperty('SHEET_ID') || ''
  };
}

function getSpreadsheet_() {
  const cfg = getConfig_();
  if (cfg.sheetId) return SpreadsheetApp.openById(cfg.sheetId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No SHEET_ID configured and no active spreadsheet found.');
  PROP.setProperty('SHEET_ID', active.getId());
  return active;
}

function setupSheetConfig() {
  const ss = getSpreadsheet_();

  Object.keys(REQUIRED_SHEETS).forEach(function(name) {
    ensureSheetWithHeader_(ss, name, REQUIRED_SHEETS[name]);
  });

  const setup = ss.getSheetByName('Settings');
  writeSettingRow_(setup, 'GUPSHUP_API_KEY', PROP.getProperty('GUPSHUP_API_KEY') || '', 'Keep actual key in Script Properties. You can update it from UI.');
  writeSettingRow_(setup, 'GUPSHUP_SOURCE', PROP.getProperty('GUPSHUP_SOURCE') || getConfig_().source, 'Registered WhatsApp Business API source number.');
  writeSettingRow_(setup, 'GUPSHUP_APP_NAME', PROP.getProperty('GUPSHUP_APP_NAME') || getConfig_().appName, 'Gupshup app name registered with the source number.');
  writeSettingRow_(setup, 'GUPSHUP_APP_ID', PROP.getProperty('GUPSHUP_APP_ID') || '', 'Required for template sync API.');
  writeSettingRow_(setup, 'SHEET_ID', ss.getId(), 'Database spreadsheet id.');
  writeSettingRow_(setup, 'WEB_APP_URL', getWebAppUrl(), 'Deploy as Web App and copy this URL into Gupshup callback/webhook.');

  seedTemplateControl_();
  return { success: true, message: 'Sheet configuration completed', spreadsheetId: ss.getId(), webAppUrl: getWebAppUrl() };
}

function ensureSheetWithHeader_(ss, name, headerRow) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  } else {
    const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headerRow.length)).getValues()[0];
    const empty = existing.every(function(v){ return v === '' || v === null; });
    if (empty) {
      sh.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
    } else {
      const missing = headerRow.filter(function(h){ return existing.indexOf(h) === -1; });
      if (missing.length) {
        sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      }
    }
  }
  sh.setFrozenRows(1);
  return sh;
}

function writeSettingRow_(sheet, key, value, notes) {
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) { rowIndex = i + 1; break; }
  }
  const data = [key, value, notes || '', new Date()];
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, data.length).setValues([data]);
  else sheet.appendRow(data);
}

function seedTemplateControl_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName('Template');
  const defaults = [
    ['Message Template', 'Hi $(name), this is a test message'],
    ['Wait Time (seconds)', 10],
    ['Pause Every N Messages', 5],
    ['Switch (On/Off)', 'Off'],
    ['Batch Limit', 50],
    ['Template ID (marketing)', ''],
    ['Template Params (comma separated headers)', 'name']
  ];
  defaults.forEach(function(row, idx) {
    const currentKey = sh.getRange(idx + 2, 1).getValue();
    if (!currentKey) sh.getRange(idx + 2, 1, 1, 2).setValues([row]);
  });
}

// ─── Server-side data cache (CacheService) ───────────────────────────────
var _CACHE_TTL = 90; // seconds

// All cache keys — cleared together on any data write
var _ALL_CACHE_KEYS = [
  'ALLDATA_V2',
  'PAGE_index','PAGE_inbox','PAGE_templates','PAGE_broadcast',
  'PAGE_contacts','PAGE_bot','PAGE_logs','PAGE_reports','PAGE_settings'
];

function _getCache(key) {
  try {
    var c = CacheService.getScriptCache();
    var meta = c.get(key + '_meta');
    if (!meta) return null;
    var chunks = parseInt(meta, 10);
    if (chunks === 1) {
      var raw = c.get(key);
      return raw ? JSON.parse(raw) : null;
    }
    var parts = [];
    for (var i = 0; i < chunks; i++) {
      var part = c.get(key + '_' + i);
      if (!part) return null;
      parts.push(part);
    }
    return JSON.parse(parts.join(''));
  } catch(e) { return null; }
}

function _setCache(key, data) {
  try {
    var c = CacheService.getScriptCache();
    var json = JSON.stringify(data);
    var chunkSize = 90000;
    if (json.length <= chunkSize) {
      var single = {}; single[key] = json; single[key + '_meta'] = '1';
      c.putAll(single, _CACHE_TTL);
    } else {
      var chunks = [];
      for (var i = 0; i < json.length; i += chunkSize) chunks.push(json.slice(i, i + chunkSize));
      if (chunks.length > 10) return; // too large — skip caching
      var items = {}; items[key + '_meta'] = String(chunks.length);
      chunks.forEach(function(ch, idx) { items[key + '_' + idx] = ch; });
      c.putAll(items, _CACHE_TTL);
    }
  } catch(e) {}
}

function _invalidateCacheKey(key) {
  try {
    var c = CacheService.getScriptCache();
    var meta = c.get(key + '_meta');
    var keys = [key, key + '_meta'];
    if (meta) for (var i = 0; i < parseInt(meta, 10); i++) keys.push(key + '_' + i);
    c.removeAll(keys);
  } catch(e) {}
}

function invalidateDataCache_() {
  _ALL_CACHE_KEYS.forEach(function(k) { _invalidateCacheKey(k); });
}
// ─────────────────────────────────────────────────────────────────────────────

function getAllData() {
  var cached = _getCache('ALLDATA_V2');
  if (cached) return cached;

  const ss = getSpreadsheet_();
  const out = {
    settings: getPublicSettings_(),
    sheets: {},
    stats: {},
    pageUrls: {
      index: getPageUrl('index'),
      settings: getPageUrl('settings'),
      inbox: getPageUrl('inbox'),
      send: getPageUrl('send'),
      templates: getPageUrl('templates'),
      broadcast: getPageUrl('broadcast'),
      contacts: getPageUrl('contacts'),
      bot: getPageUrl('bot'),
      logs: getPageUrl('logs'),
      reports: getPageUrl('reports')
    }
  };
  Object.keys(REQUIRED_SHEETS).forEach(function(name) {
    out.sheets[name] = readSheetObjects_(ss.getSheetByName(name));
  });
  out.stats = buildStats_(out.sheets);
  _setCache('ALLDATA_V2', out);
  return out;
}

// ─── inbox2: chat list + send wrappers ───────────────────────────────────────

/**
 * Returns all messages grouped into chat objects for inbox2.html.
 * No server-side cache — polled every 15 s for near-real-time updates.
 */
function getChats() {
  var ss = getSpreadsheet_();
  var data = readSheetObjects_(ss.getSheetByName('Messages'));
  var rows = data.rows || [];

  var map = {};
  var orderMap = {};

  rows.forEach(function(r, idx) {
    var phone = cleanPhone_(r.phone || '');
    if (!phone) return;
    if (!map[phone]) {
      map[phone] = {
        id: phone,
        phone: phone,
        name: r.name || phone,
        status: 'online',
        unread: 0,
        messages: [],
        lastMsg: ''
      };
    }
    if (r.name && !map[phone].name) map[phone].name = r.name;

    var ts = r.timestamp ? String(r.timestamp) : '';
    var d;
    try { d = new Date(ts); if (isNaN(d.getTime())) d = new Date(); } catch(e) { d = new Date(); }
    var time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    var date = (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));

    map[phone].messages.push({
      type: r.direction === 'out' ? 'outgoing' : 'incoming',
      text: r.message || '',
      time: time,
      date: date,
      msgType: r.type || 'text',
      mediaUrl: r.media_url || ''
    });
    map[phone].lastMsg = r.message || '';
    if (r.direction === 'in') map[phone].unread++;
    orderMap[phone] = idx;
  });

  return Object.values(map).sort(function(a, b) {
    return (orderMap[b.phone] || 0) - (orderMap[a.phone] || 0);
  });
}

/** Simple text-send wrapper called by inbox2 sendBackendText(). */
function sendMessage(phone, text) {
  return sendFromUi({ phone: phone, type: 'text', text: text || '', previewUrl: false });
}

/** Location send wrapper for inbox2. */
function sendLocationMsg(phone, lat, lng, name, address) {
  return sendFromUi({ phone: phone, type: 'location', lat: String(lat), lng: String(lng), locationName: name || '', address: address || '' });
}

/** Contact card send wrapper for inbox2. */
function sendContactMsg(phone, contactJson) {
  var c = {};
  try { c = JSON.parse(contactJson || '{}'); } catch(e) {}
  return sendFromUi({
    phone: phone, type: 'contact',
    firstName: c.firstName || '', lastName: c.lastName || '',
    contactPhone: c.phone || phone,
    email: c.email || ''
  });
}

/** Sticker send wrapper for inbox2. */
function sendStickerMsg(phone, url) {
  return sendFromUi({ phone: phone, type: 'sticker', url: url || '' });
}

/** Quick-reply button message wrapper for inbox2. */
function sendQuickReplyMsg(phone, qrDataJson) {
  var qr = {};
  try { qr = JSON.parse(qrDataJson || '{}'); } catch(e) {}
  return sendFromUi({
    phone: phone, type: 'quick_reply',
    header: qr.header || '', text: qr.body || '',
    footer: qr.footer || '',
    buttons: (qr.options || []).join(',')
  });
}

/** List / menu message wrapper for inbox2. */
function sendListMsg(phone, listDataJson) {
  var ld = {};
  try { ld = JSON.parse(listDataJson || '{}'); } catch(e) {}
  var items = (ld.items || []).map(function(item) {
    return (item.title || '') + (item.description ? '|' + item.description : '');
  }).join('\n');
  return sendFromUi({
    phone: phone, type: 'list',
    header: ld.title || '', text: ld.body || '',
    footer: ld.footer || '', buttonLabel: ld.btnLabel || 'View Options',
    items: items
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Per-page data functions (fast, fetch only what each page needs) ──────────

function getIndexData() {
  var key = 'PAGE_index';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var messages = readSheetObjects_(ss.getSheetByName('Messages'));
  var apiLogs = readSheetObjects_(ss.getSheetByName('api_logs'));
  var contacts = readSheetObjects_(ss.getSheetByName('Contacts'));
  var out = {
    settings: getPublicSettings_(),
    sheets: {
      Messages: { headers: messages.headers, rows: messages.rows.slice(-10) },
      api_logs:  { headers: apiLogs.headers,  rows: apiLogs.rows.slice(-8)  }
    },
    stats: buildStats_({ Messages: messages, api_logs: apiLogs, Contacts: contacts })
  };
  _setCache(key, out);
  return out;
}

function getInboxData() {
  var key = 'PAGE_inbox';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = { sheets: { Messages: readSheetObjects_(ss.getSheetByName('Messages')) } };
  _setCache(key, out);
  return out;
}

function getTemplatesData() {
  var key = 'PAGE_templates';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = { sheets: { Templates: readSheetObjects_(ss.getSheetByName('Templates')) } };
  _setCache(key, out);
  return out;
}

function getBroadcastData() {
  var key = 'PAGE_broadcast';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = {
    sheets: {
      Templates:         readSheetObjects_(ss.getSheetByName('Templates')),
      Contacts:          readSheetObjects_(ss.getSheetByName('Contacts')),
      'Client Database': readSheetObjects_(ss.getSheetByName('Client Database')),
      'Staff Database':  readSheetObjects_(ss.getSheetByName('Staff Database')),
      DND:               readSheetObjects_(ss.getSheetByName('DND')),
      Unsubscribe:       readSheetObjects_(ss.getSheetByName('Unsubscribe'))
    }
  };
  _setCache(key, out);
  return out;
}

function getContactsData() {
  var key = 'PAGE_contacts';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = {
    sheets: {
      Contacts:          readSheetObjects_(ss.getSheetByName('Contacts')),
      'Client Database': readSheetObjects_(ss.getSheetByName('Client Database')),
      'Staff Database':  readSheetObjects_(ss.getSheetByName('Staff Database')),
      DND:               readSheetObjects_(ss.getSheetByName('DND')),
      Unsubscribe:       readSheetObjects_(ss.getSheetByName('Unsubscribe'))
    }
  };
  _setCache(key, out);
  return out;
}

function getBotData() {
  var key = 'PAGE_bot';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = { sheets: { Bot: readSheetObjects_(ss.getSheetByName('Bot')) } };
  _setCache(key, out);
  return out;
}

function getLogsData() {
  var key = 'PAGE_logs';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = {
    sheets: {
      api_logs: readSheetObjects_(ss.getSheetByName('api_logs')),
      logs:     readSheetObjects_(ss.getSheetByName('logs')),
      Messages: readSheetObjects_(ss.getSheetByName('Messages')),
      History:  readSheetObjects_(ss.getSheetByName('History'))
    }
  };
  _setCache(key, out);
  return out;
}

function getReportsData() {
  var key = 'PAGE_reports';
  var cached = _getCache(key);
  if (cached) return cached;
  var ss = getSpreadsheet_();
  var out = {
    sheets: {
      Messages:  readSheetObjects_(ss.getSheetByName('Messages')),
      api_logs:  readSheetObjects_(ss.getSheetByName('api_logs')),
      Templates: readSheetObjects_(ss.getSheetByName('Templates')),
      Bot:       readSheetObjects_(ss.getSheetByName('Bot'))
    }
  };
  _setCache(key, out);
  return out;
}

function getSettingsData() {
  var key = 'PAGE_settings';
  var cached = _getCache(key);
  if (cached) return cached;
  var out = { settings: getPublicSettings_() };
  _setCache(key, out);
  return out;
}
// ─────────────────────────────────────────────────────────────────────────────

function getPublicSettings_() {
  const cfg = getConfig_();
  return {
    apiKeySet: !!cfg.apiKey,
    apiKeyMasked: cfg.apiKey ? mask_(cfg.apiKey) : '',
    source: cfg.source,
    appName: cfg.appName,
    appId: cfg.appId,
    sheetId: cfg.sheetId || (SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getId() : ''),
    webAppUrl: getWebAppUrl()
  };
}

function mask_(v) {
  v = String(v || '');
  if (v.length <= 8) return '********';
  return v.slice(0, 4) + '********' + v.slice(-4);
}

function readSheetObjects_(sheet) {
  if (!sheet) return { headers: [], rows: [] };
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0].map(String);
  const rows = values.slice(1).filter(function(r){ return r.some(function(c){ return c !== ''; }); }).map(function(row) {
    const o = {};
    headers.forEach(function(h, i){ o[h] = row[i] || ''; });
    return o;
  });
  return { headers: headers, rows: rows };
}

function writeSheetObjects_(sheetName, rows) {
  if (EDITABLE_SHEETS.indexOf(sheetName) === -1) throw new Error('Sheet not editable from UI: ' + sheetName);
  const ss = getSpreadsheet_();
  const headers = REQUIRED_SHEETS[sheetName];
  const sh = ensureSheetWithHeader_(ss, sheetName, headers);
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  const values = (rows || []).map(function(o) {
    return headers.map(function(h) { return o[h] === undefined ? '' : o[h]; });
  });
  if (values.length) sh.getRange(2, 1, values.length, headers.length).setValues(values);
  sh.setFrozenRows(1);
  return { success: true, sheet: sheetName, rows: values.length };
}

function appendSheetObjects_(sheetName, rows) {
  if (EDITABLE_SHEETS.indexOf(sheetName) === -1) throw new Error('Sheet not appendable from UI: ' + sheetName);
  const ss = getSpreadsheet_();
  const headers = REQUIRED_SHEETS[sheetName];
  const sh = ensureSheetWithHeader_(ss, sheetName, headers);
  const values = (rows || []).map(function(o) {
    return headers.map(function(h) { return o[h] === undefined ? '' : o[h]; });
  });
  if (values.length) sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  return { success: true, sheet: sheetName, rows: values.length };
}

function saveSettings(settings) {
  settings = settings || {};
  const ss = getSpreadsheet_();
  if (settings.sheetId) PROP.setProperty('SHEET_ID', String(settings.sheetId).trim());
  if (settings.apiKey && settings.apiKey.indexOf('*') === -1) PROP.setProperty('GUPSHUP_API_KEY', String(settings.apiKey).trim());
  if (settings.source) PROP.setProperty('GUPSHUP_SOURCE', cleanPhone_(settings.source));
  if (settings.appName) PROP.setProperty('GUPSHUP_APP_NAME', String(settings.appName).trim());
  if (settings.appId !== undefined) PROP.setProperty('GUPSHUP_APP_ID', String(settings.appId).trim());

  setupSheetConfig();
  const sh = getSpreadsheet_().getSheetByName('Settings');
  const cfg = getConfig_();
  writeSettingRow_(sh, 'GUPSHUP_API_KEY', cfg.apiKey ? mask_(cfg.apiKey) : '', 'Stored in Script Properties.');
  writeSettingRow_(sh, 'GUPSHUP_SOURCE', cfg.source, 'Registered WhatsApp Business API source number.');
  writeSettingRow_(sh, 'GUPSHUP_APP_NAME', cfg.appName, 'App name.');
  writeSettingRow_(sh, 'GUPSHUP_APP_ID', cfg.appId, 'App ID for template sync.');
  writeSettingRow_(sh, 'SHEET_ID', cfg.sheetId, 'Database spreadsheet id.');
  writeSettingRow_(sh, 'WEB_APP_URL', getWebAppUrl(), 'Callback/webhook URL.');
  return { success: true, settings: getPublicSettings_() };
}


/**
 * Public wrappers for google.script.run.
 * Apps Script treats functions ending with "_" as private, so UI pages call these.
 */
function saveSheetRows(sheetName, rows) {
  const result = writeSheetObjects_(sheetName, rows || []);
  invalidateDataCache_();
  return result;
}

function appendSheetRows(sheetName, rows) {
  const result = appendSheetObjects_(sheetName, rows || []);
  invalidateDataCache_();
  return result;
}

function buildStats_(sheets) {
  const messages = (sheets.Messages && sheets.Messages.rows) || [];
  const apiLogs = (sheets.api_logs && sheets.api_logs.rows) || [];
  const contacts = (sheets.Contacts && sheets.Contacts.rows) || [];
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const todayMsgs = messages.filter(function(m){ return String(m.timestamp || '').indexOf(today) >= 0; });
  return {
    totalMessages: messages.length,
    incoming: messages.filter(function(m){ return m.direction === 'in'; }).length,
    outgoing: messages.filter(function(m){ return m.direction === 'out'; }).length,
    todayMessages: todayMsgs.length,
    contacts: contacts.length,
    apiCalls: apiLogs.length,
    failedApiCalls: apiLogs.filter(function(l){ return String(l.status || '').toLowerCase().indexOf('fail') >= 0; }).length
  };
}

function cleanPhone_(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function requireConfig_() {
  const cfg = getConfig_();
  if (!cfg.apiKey) throw new Error('GUPSHUP_API_KEY is missing. Open Settings and save API key.');
  if (!cfg.source) throw new Error('GUPSHUP_SOURCE is missing.');
  if (!cfg.appName) throw new Error('GUPSHUP_APP_NAME is missing.');
  return cfg;
}

function gupshupFetch_(url, payload, method) {
  const cfg = requireConfig_();
  const options = {
    method: method || 'post',
    headers: { apikey: cfg.apiKey },
    muteHttpExceptions: true
  };
  if ((method || 'post').toLowerCase() !== 'get') {
    options.contentType = 'application/x-www-form-urlencoded';
  }
  if (payload) options.payload = payload;
  const response = UrlFetchApp.fetch(url, options);
  const text = response.getContentText();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  json.httpCode = response.getResponseCode();
  return json;
}

function sendGupshupMessage(destination, messageObj) {
  const cfg = requireConfig_();
  const url = 'https://api.gupshup.io/wa/api/v1/msg';
  const payload = {
    channel: 'whatsapp',
    source: cfg.source,
    destination: cleanPhone_(destination),
    message: JSON.stringify(messageObj),
    'src.name': cfg.appName
  };
  const result = gupshupFetch_(url, payload, 'post');
  logApi_(payload.destination, messageObj.type || 'unknown', result);
  logMessage_(payload.destination, '', 'out', getMessageSummary_(messageObj), messageObj.type || 'unknown', getMediaUrl_(messageObj), result.messageId || result.gsId || '', result.status || '');
  return result;
}

function sendTemplateMessage(destination, templateId, paramsArray, mediaMessageObj) {
  const cfg = requireConfig_();
  const url = 'https://api.gupshup.io/wa/api/v1/template/msg';
  const payload = {
    source: cfg.source,
    destination: cleanPhone_(destination),
    template: JSON.stringify({ id: templateId, params: paramsArray || [] })
  };
  if (cfg.appName) payload['src.name'] = cfg.appName;
  if (mediaMessageObj) payload.message = JSON.stringify(mediaMessageObj);
  const result = gupshupFetch_(url, payload, 'post');
  logApi_(payload.destination, 'template', result);
  logMessage_(payload.destination, '', 'out', '[Template] ' + templateId + ' ' + JSON.stringify(paramsArray || []), 'template', getMediaUrl_(mediaMessageObj), result.messageId || '', result.status || '');
  return result;
}

function getMessageSummary_(obj) {
  if (!obj) return '';
  if (obj.type === 'text') return obj.text || '';
  if (obj.type === 'image') return obj.caption || '[Image]';
  if (obj.type === 'video') return obj.caption || '[Video]';
  if (obj.type === 'audio') return '[Audio]';
  if (obj.type === 'file' || obj.type === 'document') return obj.filename || '[Document]';
  if (obj.type === 'location') return '[Location] ' + (obj.name || '') + ' ' + (obj.latitude || '') + ',' + (obj.longitude || '');
  if (obj.type === 'contact') return '[Contact]';
  if (obj.type === 'quick_reply') return (obj.content && obj.content.text) || '[Quick Reply]';
  if (obj.type === 'list') return obj.body || '[List]';
  return '[' + (obj.type || 'Message') + ']';
}

function getMediaUrl_(obj) {
  if (!obj) return '';
  return obj.url || obj.originalUrl || obj.previewUrl || (obj.image && obj.image.link) || (obj.video && obj.video.link) || (obj.document && obj.document.link) || '';
}

function logApi_(to, type, result) {
  const ss = getSpreadsheet_();
  const sh = ensureSheetWithHeader_(ss, 'api_logs', REQUIRED_SHEETS.api_logs);
  sh.appendRow([
    new Date(),
    to || '',
    type || '',
    (result && (result.status || result.httpCode)) || '',
    (result && (result.messageId || result.gsId || result.id)) || '',
    JSON.stringify(result || {})
  ]);
}

function logMessage_(phone, name, direction, message, type, mediaUrl, msgId, status, raw) {
  const ss = getSpreadsheet_();
  const sh = ensureSheetWithHeader_(ss, 'Messages', REQUIRED_SHEETS.Messages);
  sh.appendRow([
    new Date(),
    cleanPhone_(phone),
    name || '',
    direction || '',
    message || '',
    type || 'text',
    mediaUrl || '',
    msgId || '',
    status || '',
    raw ? JSON.stringify(raw) : ''
  ]);
}

function sendFromUi(req) {
  req = req || {};
  const phone = cleanPhone_(req.phone);
  if (!phone) throw new Error('Phone number is required.');

  const type = req.type || 'text';
  if (type === 'text') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'text', text: req.text || '', previewUrl: !!req.previewUrl }) };
  }
  if (type === 'image') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'image', originalUrl: req.url, previewUrl: req.url, caption: req.caption || '' }) };
  }
  if (type === 'file' || type === 'document') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'file', url: req.url, filename: req.filename || 'document.pdf' }) };
  }
  if (type === 'audio') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'audio', url: req.url }) };
  }
  if (type === 'video') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'video', url: req.url, caption: req.caption || '' }) };
  }
  if (type === 'sticker') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'sticker', url: req.url }) };
  }
  if (type === 'location') {
    return { success: true, result: sendGupshupMessage(phone, { type: 'location', latitude: req.lat, longitude: req.lng, name: req.locationName || '', address: req.address || '' }) };
  }
  if (type === 'contact') {
    const contact = {
      type: 'contact',
      contact: {
        addresses: [],
        birthday: '',
        emails: req.email ? [{ email: req.email, type: 'Personal' }] : [],
        name: {
          firstName: req.firstName || '',
          formattedName: ((req.firstName || '') + ' ' + (req.lastName || '')).trim(),
          lastName: req.lastName || ''
        },
        org: req.company ? { company: req.company } : {},
        phones: [{ phone: cleanPhone_(req.contactPhone || req.phone), type: 'WORK' }],
        urls: req.website ? [{ url: req.website, type: 'WORK' }] : []
      }
    };
    return { success: true, result: sendGupshupMessage(phone, contact) };
  }
  if (type === 'quick_reply') {
    const options = String(req.buttons || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean).slice(0,3).map(function(btn) {
      return { type: 'text', title: btn, postbackText: btn };
    });
    return { success: true, result: sendGupshupMessage(phone, {
      type: 'quick_reply',
      msgid: 'qr_' + Date.now(),
      version: 2,
      content: { type: 'text', header: req.header || '', text: req.text || '', footer: req.footer || '' },
      options: options
    }) };
  }
  if (type === 'list') {
    const items = parseListItems_(req.items || '');
    return { success: true, result: sendGupshupMessage(phone, {
      type: 'list',
      title: req.header || 'Options',
      body: req.text || '',
      footer: req.footer || '',
      msgid: 'list_' + Date.now(),
      globalButtons: [{ type: 'text', title: req.buttonLabel || 'View options' }],
      items: [{ title: req.header || 'Menu', subtitle: '', options: items }]
    }) };
  }

  throw new Error('Unsupported message type: ' + type);
}

function parseListItems_(text) {
  return String(text || '').split('\n').map(function(line) {
    const parts = line.split('|').map(function(p){ return p.trim(); });
    return { type: 'text', title: parts[0], description: parts[1] || '', postbackText: parts[0] };
  }).filter(function(o){ return o.title; }).slice(0, 10);
}

function sendTemplateFromUi(req) {
  req = req || {};
  const params = parseParams_(req.params);
  let media = null;
  if (req.mediaType && req.mediaUrl) {
    if (req.mediaType === 'image') media = { type: 'image', image: { link: req.mediaUrl } };
    if (req.mediaType === 'video') media = { type: 'video', video: { link: req.mediaUrl } };
    if (req.mediaType === 'document') media = { type: 'document', document: { link: req.mediaUrl } };
    if (req.mediaType === 'location') media = { type: 'location', location: { latitude: req.lat || '', longitude: req.lng || '' } };
  }
  return { success: true, result: sendTemplateMessage(req.phone, req.templateId, params, media) };
}

function parseParams_(value) {
  if (Array.isArray(value)) return value;
  value = String(value || '').trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch(e) {}
  return value.split(',').map(function(v){ return v.trim(); });
}

function sendBroadcastBatch(items) {
  items = items || [];
  if (items.length > 50) throw new Error('Max 50 messages per server batch. Reduce client batch size.');
  const results = [];
  items.forEach(function(item) {
    try {
      let result;
      if (item.mode === 'template') {
        result = sendTemplateMessage(item.phone, item.templateId, item.params || [], item.media || null);
      } else {
        result = sendGupshupMessage(item.phone, { type: 'text', text: item.text || '', previewUrl: false });
      }
      results.push({ phone: item.phone, success: true, result: result });
    } catch (err) {
      results.push({ phone: item.phone, success: false, error: String(err) });
    }
  });
  return { success: true, count: results.length, results: results };
}

function uploadAndSendAttachment(phone, fileName, mimeType, base64Data, caption) {
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const file = DriveApp.getRootFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const publicUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();

  let req = { phone: phone, type: 'file', url: publicUrl, filename: fileName, caption: caption || '' };
  if (mimeType.indexOf('image/') === 0) req.type = 'image';
  else if (mimeType.indexOf('audio/') === 0) req.type = 'audio';
  else if (mimeType.indexOf('video/') === 0) req.type = 'video';

  const sent = sendFromUi(req);
  return { success: true, publicUrl: publicUrl, result: sent.result };
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    if (!raw) return respond_('OK');
    const event = JSON.parse(raw);

    if (event.type === 'message-event' && event.payload) {
      handleMessageEvent_(event);
      return respond_('OK');
    }

    const inbound = extractGupshupInbound_(event);
    if (inbound && inbound.sender) {
      logMessage_(inbound.sender, inbound.name, 'in', inbound.text, inbound.msgType || 'text', inbound.mediaUrl || '', inbound.messageId || '', '', event);
      logInboundRaw_(inbound.name, inbound.sender, inbound.text, event);
      autoSaveContact_(inbound.sender, inbound.name);
      invalidateDataCache_();
      try { reply(inbound.sender, inbound.text); } catch (err) { Logger.log('Auto-reply error: ' + err); }
    }

    return respond_('OK');
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return respond_('ERROR: ' + err);
  }
}

function respond_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}

function handleMessageEvent_(event) {
  const p = event.payload || {};
  const ss = getSpreadsheet_();
  const sh = ensureSheetWithHeader_(ss, 'api_logs', REQUIRED_SHEETS.api_logs);
  sh.appendRow([
    new Date(event.timestamp || Date.now()),
    p.destination || '',
    'message-event',
    p.type || '',
    p.gsId || p.id || '',
    JSON.stringify(event)
  ]);
}

function logInboundRaw_(name, phone, text, raw) {
  const ss = getSpreadsheet_();
  const sh = ensureSheetWithHeader_(ss, 'logs', REQUIRED_SHEETS.logs);
  sh.appendRow([new Date(), name || '', cleanPhone_(phone), text || '', JSON.stringify(raw || {})]);
}

function extractGupshupInbound_(event) {
  if (!event) return null;

  if (event.type === 'message' && event.payload) {
    const p = event.payload;
    return {
      sender: cleanPhone_(p.sender && (p.sender.phone || p.sender.dial_code || p.sender.id) || p.source || p.phone || ''),
      name: (p.sender && p.sender.name) || '',
      text: extractInboundText_(p.payload || p.message || p),
      msgType: (p.payload && p.payload.type) || p.type || 'text',
      mediaUrl: extractInboundMediaUrl_(p.payload || p.message || p),
      messageId: p.id || p.messageId || '',
      raw: event
    };
  }

  if (event.user && event.message) {
    return {
      sender: cleanPhone_(event.user.phone || event.user.id || ''),
      name: event.user.name || '',
      text: String(event.message.text || event.message.caption || event.message.message || ''),
      msgType: event.message.type || 'text',
      mediaUrl: event.message.url || event.message.originalUrl || '',
      messageId: event.message.id || '',
      raw: event
    };
  }

  let payload = event;
  if (event.entry && event.entry[0] && event.entry[0].changes && event.entry[0].changes[0]) {
    payload = event.entry[0].changes[0].value || event;
  }
  const messages = payload.messages || [];
  const contacts = payload.contacts || [];
  if (!messages.length) return null;
  const message = messages[0];
  const contact = contacts[0] || {};
  const type = message.type || 'text';
  const sender = cleanPhone_(contact.wa_id || contact.phone || message.from || message.phone || message.sender || '');
  const name = (contact.profile && contact.profile.name) || contact.name || '';
  return {
    sender: sender,
    name: name,
    text: extractInboundText_(message),
    msgType: type,
    mediaUrl: extractInboundMediaUrl_(message),
    messageId: message.id || '',
    raw: payload
  };
}

function extractInboundText_(message) {
  if (!message) return '';
  const type = message.type || '';
  if (type === 'text') return (message.text && (message.text.body || message.text)) || message.body || '';
  if (type === 'button') return (message.button && (message.button.text || message.button.payload)) || '';
  if (type === 'interactive') {
    if (message.interactive && message.interactive.button_reply) return message.interactive.button_reply.title || message.interactive.button_reply.id || '';
    if (message.interactive && message.interactive.list_reply) return message.interactive.list_reply.title || message.interactive.list_reply.id || '';
  }
  if (type === 'image') return message.caption || '[Image]';
  if (type === 'document') return (message.document && message.document.filename) || '[Document]';
  if (type === 'audio') return '[Audio]';
  if (type === 'video') return message.caption || '[Video]';
  if (type === 'location' && message.location) return '[Location] ' + message.location.latitude + ',' + message.location.longitude;
  if (message.caption) return message.caption;
  return message.text || '';
}

function extractInboundMediaUrl_(message) {
  if (!message) return '';
  if (message.image) return message.image.url || message.image.link || '';
  if (message.document) return message.document.url || message.document.link || '';
  if (message.audio) return message.audio.url || message.audio.link || '';
  if (message.video) return message.video.url || message.video.link || '';
  return message.url || '';
}

function autoSaveContact_(phone, name) {
  if (!phone) return;
  try {
    const ss = getSpreadsheet_();
    const contacts = ensureSheetWithHeader_(ss, 'Contacts', REQUIRED_SHEETS.Contacts);
    if (sheetHasPhone_(contacts, phone)) return;
    contacts.appendRow([phone, name || '', '', '', 'yes', new Date(), 'inbound', '']);
  } catch (e) { Logger.log('autoSaveContact_ error: ' + e); }
}

function sheetHasPhone_(sheet, phone) {
  if (!sheet || !phone) return false;
  const target = cleanPhone_(phone);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  return values.some(function(row) { return cleanPhone_(row[0]) === target; });
}

function parseButtonLabels_(buttonText) {
  return String(buttonText || '').split(',').map(function(item){ return item.trim(); }).filter(Boolean).slice(0, 3);
}

function reply(sender, text) {
  const ss = getSpreadsheet_();
  const bot = ensureSheetWithHeader_(ss, 'Bot', REQUIRED_SHEETS.Bot);
  const unsub = ensureSheetWithHeader_(ss, 'Unsubscribe', REQUIRED_SHEETS.Unsubscribe);
  const dnd = ensureSheetWithHeader_(ss, 'DND', REQUIRED_SHEETS.DND);
  const clientdb = ensureSheetWithHeader_(ss, 'Client Database', REQUIRED_SHEETS['Client Database']);
  const staffdb = ensureSheetWithHeader_(ss, 'Staff Database', REQUIRED_SHEETS['Staff Database']);
  const history = ensureSheetWithHeader_(ss, 'History', REQUIRED_SHEETS.History);

  const incomingText = String(text || '').trim();
  const senderPhone = cleanPhone_(sender);
  if (!incomingText) return;

  if (incomingText.toLowerCase() === 'unsubscribe') {
    if (!sheetHasPhone_(unsub, senderPhone)) unsub.appendRow([senderPhone, 'keyword', new Date()]);
    return;
  }

  if (sheetHasPhone_(unsub, senderPhone) || sheetHasPhone_(dnd, senderPhone)) return;

  const sdb = sheetHasPhone_(staffdb, senderPhone);
  const cdb = sheetHasPhone_(clientdb, senderPhone);
  const rows = bot.getDataRange().getValues().slice(1);
  const matches = rows.filter(function(row) {
    return String(row[0] || '').trim().toLowerCase() === incomingText.toLowerCase();
  });

  matches.forEach(function(row) {
    let role = 'New';
    let replyText = row[1] || '';
    let title = row[2] || '';
    let buttons = row[3] || '';

    if (sdb) {
      role = 'Staff';
      replyText = row[4] || replyText;
      title = row[5] || title;
      buttons = row[6] || buttons;
    } else if (cdb) {
      role = 'Client';
      replyText = row[7] || replyText;
      title = row[8] || title;
      buttons = row[9] || buttons;
    }

    const status = sendBotMsg_(senderPhone, replyText, title, buttons);
    history.appendRow([new Date(), role, senderPhone, incomingText, replyText, status]);
  });

  if (!matches.length) {
    const fallback = rows.find(function(row) {
      const kw = String(row[0] || '').trim();
      return kw === '*' || kw.toLowerCase() === 'default';
    });
    if (fallback) {
      let replyText = fallback[1] || '', title = fallback[2] || '', buttons = fallback[3] || '';
      if (sdb) { replyText = fallback[4] || replyText; title = fallback[5] || title; buttons = fallback[6] || buttons; }
      else if (cdb) { replyText = fallback[7] || replyText; title = fallback[8] || title; buttons = fallback[9] || buttons; }
      const status = sendBotMsg_(senderPhone, replyText, title, buttons);
      history.appendRow([new Date(), sdb ? 'Staff' : cdb ? 'Client' : 'New', senderPhone, incomingText, replyText, status]);
    }
  }
}

function sendBotMsg_(sender, replyText, title, buttons) {
  const labels = parseButtonLabels_(buttons);
  let payload;
  if (labels.length) {
    payload = {
      type: 'quick_reply',
      msgid: 'btn_' + Date.now(),
      content: { type: 'text', header: title || '', text: replyText || '', footer: '' },
      options: labels.map(function(label){ return { type: 'text', title: label, postbackText: label }; })
    };
  } else {
    payload = { type: 'text', text: replyText || '', previewUrl: false };
  }
  const result = sendGupshupMessage(sender, payload);
  return !!(result && (result.status === 'submitted' || result.httpCode < 400));
}

function syncGupshupTemplates() {
  const cfg = requireConfig_();
  if (!cfg.appId) throw new Error('GUPSHUP_APP_ID is required for template sync.');
  const url = 'https://api.gupshup.io/wa/app/' + encodeURIComponent(cfg.appId) + '/template?pageNo=0&pageSize=100';
  const result = gupshupFetch_(url, null, 'get');
  logApi_('', 'template-sync', result);

  const list = result.templates || result.data || result.payload || result.templateList || [];
  const rows = Array.isArray(list) ? list.map(function(t) {
    return {
      local_name: t.elementName || t.name || t.templateName || t.id || '',
      template_id: t.id || t.templateId || '',
      language: t.languageCode || t.language || '',
      category: t.category || t.templateCategory || '',
      type: t.templateType || t.type || '',
      body: t.data || t.body || t.content || '',
      params: '',
      media_type: '',
      media_url: '',
      status: t.status || t.templateStatus || '',
      updated_at: new Date()
    };
  }) : [];

  if (rows.length) appendSheetObjects_('Templates', rows);
  invalidateDataCache_();
  return { success: true, imported: rows.length, raw: result };
}

function createTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('sendPendingBatchFromSheet').timeBased().everyMinutes(10).create();
  return { success: true };
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sendPendingBatchFromSheet') ScriptApp.deleteTrigger(trigger);
  });
  return { success: true };
}

function sendPendingBatchFromSheet() {
  const ss = getSpreadsheet_();
  const data = ensureSheetWithHeader_(ss, 'Data', REQUIRED_SHEETS.Data);
  const template = ensureSheetWithHeader_(ss, 'Template', REQUIRED_SHEETS.Template);
  const values = data.getDataRange().getDisplayValues();
  if (values.length <= 1) return { success: true, sent: 0 };

  const templateRows = template.getDataRange().getDisplayValues();
  const control = {};
  templateRows.forEach(function(r){ if (r[0]) control[r[0]] = r[1]; });
  if (String(control['Switch (On/Off)'] || '').toLowerCase() !== 'on') return { success: true, sent: 0, message: 'Switch is Off' };

  const headers = values[0];
  const phoneIdx = headers.indexOf('phone');
  const nameIdx = headers.indexOf('name');
  const statusIdx = headers.indexOf('status');
  const batchLimit = Number(control['Batch Limit'] || 20);
  const msgTemplate = control['Message Template'] || 'Hi $(name)';

  const unsubSheet = ensureSheetWithHeader_(ss, 'Unsubscribe', REQUIRED_SHEETS.Unsubscribe);
  const dndSheet = ensureSheetWithHeader_(ss, 'DND', REQUIRED_SHEETS.DND);

  let sent = 0;
  for (let i = 1; i < values.length && sent < batchLimit; i++) {
    if (statusIdx >= 0 && String(values[i][statusIdx]).toLowerCase() === 'sent') continue;
    const rowObj = {};
    headers.forEach(function(h, idx){ rowObj[h] = values[i][idx]; });
    const phone = cleanPhone_(phoneIdx >= 0 ? values[i][phoneIdx] : rowObj.phone);
    if (!phone) continue;
    if (sheetHasPhone_(unsubSheet, phone) || sheetHasPhone_(dndSheet, phone)) {
      if (statusIdx >= 0) data.getRange(i + 1, statusIdx + 1).setValue('skipped');
      continue;
    }
    const text = applyVariables_(msgTemplate, rowObj);
    const result = sendGupshupMessage(phone, { type: 'text', text: text, previewUrl: false });
    if (statusIdx >= 0) data.getRange(i + 1, statusIdx + 1).setValue((result && result.status) || 'sent');
    sent++;
  }
  return { success: true, sent: sent };
}

function applyVariables_(template, data) {
  return String(template || '').replace(/\$\(([^)]+)\)/g, function(_, key) {
    return data[key.trim()] || '';
  });
}
