import { ClipboardEvent, DragEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api';
import { formatSize } from '../lib/helpers';
import { useChat } from '../context/ChatContext';
import type { UploadResult } from '../types';

const MAX_BYTES = 25 * 1024 * 1024;
interface Pending { id: string; file: File; preview?: string }

export default function MessageInput({ conversationId }: { conversationId: string }) {
  const { sendMessage, connected } = useChat();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  // Drafts do not carry over between chats.
  useEffect(() => { setText(''); setPending([]); }, [conversationId]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const addFiles = (files: File[]) => {
    const accepted: Pending[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) { toast.error(`${file.name} is larger than 25 MB.`); continue; }
      accepted.push({
        id: Math.random().toString(36).slice(2),
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    }
    if (accepted.length) setPending((p) => [...p, ...accepted]);
  };

  const removePending = (id: string) =>
    setPending((p) => {
      p.filter((x) => x.id === id && x.preview).forEach((x) => URL.revokeObjectURL(x.preview!));
      return p.filter((x) => x.id !== id);
    });

  // Ctrl+V: screenshots / copied images become attachments; plain text pastes normally.
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0 || e.clipboardData.getData('text/plain')) return;
    e.preventDefault();
    addFiles(files.map((f) => {
      const generic = !f.name || /^image\.\w+$/i.test(f.name);
      return generic ? new File([f], `pasted-${Date.now()}.${f.type.split('/')[1] ?? 'png'}`, { type: f.type }) : f;
    }));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const send = async () => {
    const content = text.trim();
    if (sending || (!content && pending.length === 0)) return;
    setSending(true);
    try {
      let caption: string | null = content || null; // the text rides along with the first attachment
      for (const p of pending) {
        const form = new FormData();
        form.append('file', p.file);
        const { data } = await api.post<UploadResult>('/api/files/upload', form);
        await sendMessage({
          conversationId, type: data.isImage ? 'Image' : 'File', content: caption,
          fileUrl: data.url, fileName: data.fileName, fileSize: data.size,
        });
        caption = null;
      }
      if (pending.length === 0) await sendMessage({ conversationId, type: 'Text', content });
      pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      setPending([]);
      setText('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  };

  return (
    <div className={`border-t border-slate-200 bg-white p-3 ${dragOver ? 'ring-2 ring-inset ring-brand-500' : ''}`}
         onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
         onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {pending.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <li key={p.id} className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 pr-8">
              {p.preview
                ? <img src={p.preview} alt="" className="h-14 w-14 rounded object-cover" />
                : <FileText size={28} className="m-2 text-slate-500" />}
              <span className="max-w-[10rem] text-xs">
                <span className="block truncate font-semibold">{p.file.name}</span>
                <span className="text-slate-500">{formatSize(p.file.size)}</span>
              </span>
              <button className="absolute right-1 top-1 rounded-full p-1 text-slate-500 hover:bg-slate-200"
                      onClick={() => removePending(p.id)} aria-label={`Remove ${p.file.name}`}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input ref={picker} type="file" multiple hidden
               onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <button className="icon-btn" onClick={() => picker.current?.click()} aria-label="Attach files"><Paperclip size={20} /></button>
        <textarea ref={area} rows={1} value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown} onPaste={onPaste} maxLength={4000}
                  placeholder="Type a message, or paste an image"
                  className="field max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-2xl" />
        <button className="btn h-10 w-10 !rounded-full !p-0" onClick={() => void send()}
                disabled={sending || !connected || (!text.trim() && pending.length === 0)} aria-label="Send message">
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
