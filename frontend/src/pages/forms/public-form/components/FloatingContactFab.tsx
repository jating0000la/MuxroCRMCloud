import { useState } from 'react';
import { Mail, MessageCircle, Phone, Plus, X } from 'lucide-react';
import { PageConfig } from '../types';

interface FloatingContactFabProps {
  pageConfig: PageConfig;
  primaryColor: string;
}

interface FabAction {
  key: string;
  href: string;
  label: string;
  bg: string;
  icon: JSX.Element;
}

/** Expandable "premium" floating action button exposing WhatsApp / Call / Email shortcuts. */
export default function FloatingContactFab({ pageConfig, primaryColor }: FloatingContactFabProps) {
  const [open, setOpen] = useState(false);

  const actions: FabAction[] = [
    pageConfig.showWhatsapp && pageConfig.whatsappNumber && {
      key: 'whatsapp',
      href: `https://wa.me/${pageConfig.whatsappNumber.replace(/\D/g, '')}`,
      label: 'WhatsApp Us',
      bg: '#25d366',
      icon: <MessageCircle className="w-5 h-5" />,
    },
    pageConfig.showCall && pageConfig.callNumber && {
      key: 'call',
      href: `tel:${pageConfig.callNumber}`,
      label: 'Call Us',
      bg: primaryColor,
      icon: <Phone className="w-5 h-5" />,
    },
    pageConfig.showEmail && pageConfig.contactEmailBtn && {
      key: 'email',
      href: `mailto:${pageConfig.contactEmailBtn}`,
      label: 'Email Us',
      bg: '#6366f1',
      icon: <Mail className="w-5 h-5" />,
    },
  ].filter(Boolean) as FabAction[];

  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open &&
        actions.map((action, i) => (
          <a
            key={action.key}
            href={action.href}
            target={action.key === 'whatsapp' ? '_blank' : undefined}
            rel={action.key === 'whatsapp' ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-3 animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">{action.label}</span>
            <span
              className="rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 flex-shrink-0"
              style={{ backgroundColor: action.bg, width: 48, height: 48 }}
            >
              {action.icon}
            </span>
          </a>
        ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close contact options' : 'Open contact options'}
        className="rounded-full shadow-xl flex items-center justify-center text-white transition-all hover:scale-105"
        style={{ backgroundColor: primaryColor, width: 56, height: 56 }}
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
}
