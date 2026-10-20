import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Camera, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage } from '../lib/api';
import { formatSize } from '../lib/helpers';
import { useUploadConfig } from '../lib/uploadConfig';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';
import Avatar from './Avatar';
import Modal from './Modal';

const schema = yup.object({ displayName: yup.string().trim().required('Enter a display name').max(50, 'Use 50 characters or fewer') });

export default function ProfileModal({ onClose }: { onClose(): void }) {
  const { user, setUser, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const cfg = useUploadConfig();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } =
    useForm({ resolver: yupResolver(schema), defaultValues: { displayName: user?.displayName ?? '' } });

  if (!user) return null;

  const save = handleSubmit(async (v) => {
    try {
      const { data } = await api.put<User>('/api/users/me', v);
      setUser(data);
      toast.success('Profile saved');
    } catch (e) { toast.error(errorMessage(e)); }
  });

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > cfg.maxAvatarSizeBytes) { toast.error(`Photo must be ${formatSize(cfg.maxAvatarSizeBytes)} or smaller.`); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<User>('/api/users/me/avatar', form);
      setUser(data);
      toast.success('Photo updated');
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); }
  };

  return (
    <Modal title="Your profile" onClose={onClose}>
      <div className="mb-5 flex flex-col items-center gap-2">
        <Avatar name={user.displayName} src={user.avatarUrl} size={88} />
        <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn-ghost" disabled={uploading} onClick={() => picker.current?.click()}>
          <Camera size={16} /> {uploading ? 'Uploading…' : 'Change photo'}
        </button>
        <p className="text-sm text-slate-500">@{user.userName}</p>
      </div>

      <form onSubmit={save} className="space-y-3">
        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-semibold">Display name</label>
          <input id="displayName" className="field" {...register('displayName')} />
          {errors.displayName && <p className="mt-1 text-xs text-rose-600">{errors.displayName.message}</p>}
        </div>
        <button className="btn w-full" disabled={isSubmitting || !isDirty}>Save changes</button>
      </form>

      <button className="btn-ghost mt-3 w-full !text-rose-600" onClick={() => void logout()}>
        <LogOut size={16} /> Sign out
      </button>
    </Modal>
  );
}
