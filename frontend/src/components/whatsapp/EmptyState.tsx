import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950">
      {/* Floating WhatsApp-style icon */}
      <div className="relative mb-6">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-2xl shadow-green-500/20">
          <MessageCircle className="h-14 w-14 text-white" strokeWidth={1.5} />
        </div>
        {/* Decorative dots */}
        <div className="absolute -left-4 -top-4 h-4 w-4 rounded-full bg-primary-200 opacity-60 dark:bg-primary-800" />
        <div className="absolute -right-2 top-0 h-3 w-3 rounded-full bg-green-200 opacity-60 dark:bg-green-800" />
        <div className="absolute -bottom-2 left-6 h-2.5 w-2.5 rounded-full bg-amber-200 opacity-60 dark:bg-amber-800" />
      </div>

      <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">
        Select a conversation
      </h2>
      <p className="mt-2 max-w-xs text-center text-sm text-slate-500 dark:text-gray-400">
        Choose a customer from the sidebar to start chatting and manage your CRM conversations.
      </p>

      {/* Feature hints */}
      {/* <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <FeaturePill icon="💬" label="Real-time Chat" />
        <FeaturePill icon="🤖" label="AI Assistant" />
        <FeaturePill icon="📊" label="CRM Insights" />
        <FeaturePill icon="🔔" label="Follow-ups" />
      </div> */}
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
