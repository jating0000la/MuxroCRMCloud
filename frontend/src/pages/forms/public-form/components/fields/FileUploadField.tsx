import { DragEvent, useCallback, useRef, useState } from 'react';
import { File as FileIcon, UploadCloud, X } from 'lucide-react';
import { UploadedFileValue } from '../../types';
import { MAX_UPLOAD_BYTES } from '../../constants';

interface FileUploadFieldProps {
  value: UploadedFileValue | undefined;
  primaryColor: string;
  onChange: (value: UploadedFileValue | undefined) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Lightweight file-upload UI. There is no dedicated upload endpoint, so the file is
 * inlined as a base64 data URL inside the JSON submission payload (small files only).
 */
export default function FileUploadField({ value, primaryColor, onChange }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState('');

  const readFile = useCallback(
    (file: File) => {
      setSizeError('');
      if (file.size > MAX_UPLOAD_BYTES) {
        setSizeError(`File is too large. Max size is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        onChange({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  if (value) {
    return (
      <div className="mt-1 flex items-center justify-between gap-3 p-3.5 border border-gray-200 rounded-xl bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{value.name}</p>
            <p className="text-xs text-gray-400">{formatBytes(value.size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => onChange(undefined)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0" aria-label="Remove file">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center ${
          dragOver ? 'bg-gray-50' : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
        style={dragOver ? { borderColor: primaryColor } : undefined}
      >
        <UploadCloud className="w-7 h-7 text-gray-400" />
        <p className="text-sm text-gray-600">
          <span className="font-semibold" style={{ color: primaryColor }}>
            Click to upload
          </span>{' '}
          or drag and drop
        </p>
        <p className="text-xs text-gray-400">Max file size {formatBytes(MAX_UPLOAD_BYTES)}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />
      {sizeError && <p className="mt-1.5 text-xs text-red-600">{sizeError}</p>}
    </div>
  );
}
