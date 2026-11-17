import { SQLWrapper, sql } from 'drizzle-orm';

export function normalizeWhatsAppPhone(value: unknown): string {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (/^0\d{10}$/.test(phone)) phone = phone.slice(1);
  return /^\d{10}$/.test(phone) ? '91' + phone : phone;
}

export function whatsappPhoneSql(phone: SQLWrapper) {
  return sql`CASE
    WHEN regexp_replace(coalesce(${phone}, ''), '[^0-9]', '', 'g') ~ '^00' THEN substring(regexp_replace(${phone}, '[^0-9]', '', 'g') from 3)
    WHEN regexp_replace(coalesce(${phone}, ''), '[^0-9]', '', 'g') ~ '^0[0-9]{10}$' THEN '91' || right(regexp_replace(${phone}, '[^0-9]', '', 'g'), 10)
    WHEN regexp_replace(coalesce(${phone}, ''), '[^0-9]', '', 'g') ~ '^[0-9]{10}$' THEN '91' || regexp_replace(${phone}, '[^0-9]', '', 'g')
    ELSE regexp_replace(coalesce(${phone}, ''), '[^0-9]', '', 'g') END`;
}
