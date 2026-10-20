import { useEffect, useState } from 'react';
import { api } from './api';
import { formatSize } from './helpers';

export interface UploadConfig {
  maxFileSizeBytes: number;
  maxAvatarSizeBytes: number;
  allowedExtensions: string[];
  blockedExtensions: string[];
}

// Used until the server answers (or if it cannot be reached); the server still enforces its own limits.
const FALLBACK: UploadConfig = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxAvatarSizeBytes: 5 * 1024 * 1024,
  allowedExtensions: [],
  blockedExtensions: [],
};

let cached: Promise<UploadConfig> | null = null;

function loadUploadConfig(): Promise<UploadConfig> {
  cached ??= api.get<UploadConfig>('/api/files/config')
    .then((r) => r.data)
    .catch(() => { cached = null; return FALLBACK; });
  return cached;
}

export function useUploadConfig(): UploadConfig {
  const [cfg, setCfg] = useState<UploadConfig>(FALLBACK);
  useEffect(() => {
    let alive = true;
    void loadUploadConfig().then((c) => alive && setCfg(c));
    return () => { alive = false; };
  }, []);
  return cfg;
}

const extOf = (name: string) => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
};

/** Returns an error message, or null when the file may be uploaded as an attachment. */
export function checkAttachment(file: File, cfg: UploadConfig): string | null {
  const ext = extOf(file.name);
  if (cfg.blockedExtensions.includes(ext)) return `${file.name}: files of type ${ext || 'without an extension'} are not allowed.`;
  if (cfg.allowedExtensions.length > 0 && !cfg.allowedExtensions.includes(ext))
    return `${file.name}: allowed types are ${cfg.allowedExtensions.join(', ')}.`;
  if (file.size > cfg.maxFileSizeBytes) return `${file.name} is larger than ${formatSize(cfg.maxFileSizeBytes)}.`;
  return null;
}
