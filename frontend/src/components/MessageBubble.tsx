import { Check, CheckCheck, Download, FileText } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { deliveryStatus, formatSize, formatTime } from '../lib/helpers';
import type { Message } from '../types';

interface Props { message: Message; own: boolean; showSender: boolean }

function Ticks({ message }: { message: Message }) {
  const s = deliveryStatus(message);
  if (s === 'sent') return <Check size={14} aria-label="Sent" />;
  return <CheckCheck size={14} aria-label={s === 'read' ? 'Read' : 'Delivered'} className={s === 'read' ? 'text-sky-300' : ''} />;
}

export default function MessageBubble({ message: m, own, showSender }: Props) {
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm md:max-w-[65%] ${own ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white'}`}>
        {showSender && !own && <p className="mb-0.5 text-xs font-bold text-brand-600">{m.senderName}</p>}

        {m.type === 'Image' && m.fileUrl && (
          <a href={fileUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="mb-1 block">
            <img src={fileUrl(m.fileUrl)} alt={m.fileName ?? 'Photo'} loading="lazy"
                 className="max-h-72 w-full rounded-lg object-cover" />
          </a>
        )}

        {m.type === 'File' && m.fileUrl && (
          <a href={fileUrl(m.fileUrl)} download={m.fileName ?? undefined} target="_blank" rel="noreferrer"
             className={`mb-1 flex items-center gap-3 rounded-lg p-2 ${own ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-100 hover:bg-slate-200'}`}>
            <FileText size={28} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.fileName}</span>
              <span className="text-xs opacity-75">{formatSize(m.fileSize)}</span>
            </span>
            <Download size={18} className="shrink-0" />
          </a>
        )}

        {m.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</p>}

        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${own ? 'text-white/75' : 'text-slate-400'}`}>
          <time dateTime={m.sentAt}>{formatTime(m.sentAt)}</time>
          {own && <Ticks message={m} />}
        </div>
      </div>
    </div>
  );
}
