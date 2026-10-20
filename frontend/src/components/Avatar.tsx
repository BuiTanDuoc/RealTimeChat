import { fileUrl } from '../lib/api';

const COLORS = ['bg-teal-600', 'bg-sky-600', 'bg-indigo-500', 'bg-rose-500', 'bg-amber-600', 'bg-emerald-600', 'bg-fuchsia-600'];

interface Props { name: string; src?: string | null; size?: number; online?: boolean | null }

export default function Avatar({ name, src, size = 40, online }: Props) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const color = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={fileUrl(src)} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className={`flex h-full w-full items-center justify-center rounded-full font-semibold text-white ${color}`}
              style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
      {online != null && (
        <span title={online ? 'Online' : 'Offline'}
              className={`absolute bottom-0 right-0 block rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
              style={{ width: size * 0.3, height: size * 0.3 }} />
      )}
    </span>
  );
}
