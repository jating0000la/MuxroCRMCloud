import { Calendar, MapPin, Mail, MessageSquare, Phone, User } from 'lucide-react';

/** Best-effort icon for text-like inputs, inferred from the field name/type (purely cosmetic). */
export function getFieldIcon(fieldName: string, fieldType: string) {
  const n = fieldName.toLowerCase();
  const iconProps = { className: 'w-4 h-4' };
  if (n.includes('name')) return <User {...iconProps} />;
  if (n.includes('email')) return <Mail {...iconProps} />;
  if (n.includes('phone') || n.includes('mobile')) return <Phone {...iconProps} />;
  if (n.includes('city') || n.includes('address')) return <MapPin {...iconProps} />;
  if (n.includes('message') || n.includes('note') || fieldType === 'textarea') return <MessageSquare {...iconProps} />;
  if (fieldType === 'date') return <Calendar {...iconProps} />;
  return null;
}
