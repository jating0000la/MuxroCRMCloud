import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Mic } from 'lucide-react';
import AttachmentMenu, { AttachmentType } from './AttachmentMenu';

interface ComposeBarProps {
  sending: boolean;
  onSendText: (text: string) => Promise<void> | void;
  onSendMedia: (type: AttachmentType, url: string, caption?: string) => Promise<void> | void;
}

export default function ComposeBar({
  sending,
  onSendText,
  onSendMedia,
}: ComposeBarProps) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [attachType, setAttachType] = useState<AttachmentType | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) setShowAttach(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height = Math.min(textRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleSendText = async () => {
    if (!text.trim()) return;
    const msg = text.trim();
    setText('');
    try {
      await onSendText(msg);
    } catch {
      // Error already handled by parent
    }
  };

  const handleAttachmentSelect = (type: AttachmentType) => {
    setAttachType(type);
    setShowAttach(false);
  };

  const handleSendMedia = async () => {
    if (!attachType || !mediaUrl.trim()) return;
    try {
      await onSendMedia(attachType, mediaUrl.trim(), mediaCaption.trim() || undefined);
      resetMediaFields();
    } catch {
      // Error already handled by parent
    }
  };

  const resetMediaFields = () => {
    setAttachType(null);
    setMediaUrl('');
    setMediaCaption('');
  };

  // Render media input form
  const renderMediaForm = () => {
    if (!attachType) return null;

    return (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-600 dark:bg-gray-800/50">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold capitalize text-slate-600 dark:text-gray-300">
            Send {attachType}
          </span>
          <button onClick={resetMediaFields} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-gray-700">
            ✕
          </button>
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder={`${attachType.charAt(0).toUpperCase() + attachType.slice(1)} URL...`}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
          />
          {(attachType === 'image') && (
            <input
              type="text"
              value={mediaCaption}
              onChange={(e) => setMediaCaption(e.target.value)}
              placeholder="Caption (optional)..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-slate-200"
            />
          )}
        </div>
        <button
          onClick={handleSendMedia}
          disabled={sending || !mediaUrl.trim()}
          className="mt-2 w-full rounded-lg bg-primary-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {sending ? 'Sending...' : `Send ${attachType.charAt(0).toUpperCase() + attachType.slice(1)}`}
        </button>
      </div>
    );
  };

  return (
    <div className="relative border-t border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      {/* Media form */}
      {renderMediaForm()}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <div ref={attachRef} className="relative">
          <button
            onClick={() => { setShowAttach(!showAttach); }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <AttachmentMenu isOpen={showAttach} onClose={() => setShowAttach(false)} onSelect={handleAttachmentSelect} />
        </div>

        {/* Text input */}
        <div className="flex flex-1 items-end rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-primary-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/10 dark:border-gray-600 dark:bg-gray-800 dark:focus-within:border-primary-500 dark:focus-within:bg-gray-800">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-gray-500"
            rows={1}
          />
          <button className="ml-2 flex-shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300">
            <Smile className="h-5 w-5" />
          </button>
        </div>

        {/* Voice / Send button */}
        {text.trim() ? (
          <button
            onClick={handleSendText}
            disabled={sending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-all hover:bg-green-600 hover:shadow-xl hover:shadow-green-500/40 disabled:opacity-50 disabled:shadow-none"
          >
            {sending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        ) : (
          <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800">
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Hint */}
      <div className="mt-1.5 px-1">
        <span className="text-[10px] text-slate-400 dark:text-gray-500">
          Enter to send · Shift+Enter for newline
        </span>
      </div>
    </div>
  );
}
