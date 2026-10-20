import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

function Shell({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-brand-700">
          <MessageCircle size={28} /><span className="text-xl font-extrabold">RealTimeChat</span>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="mb-4 text-2xl font-extrabold">{title}</h1>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
      </div>
    </main>
  );
}

type FieldProps = { id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>;

// forwardRef is required: react-hook-form's register() hands us a ref to attach to the <input>.
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ id, label, error, ...rest }, ref) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <input id={id} ref={ref} className="field" aria-invalid={!!error} {...rest} />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
});

const loginSchema = yup.object({
  userName: yup.string().trim().required('Enter your username or email'),
  password: yup.string().required('Enter your password'),
});

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: yupResolver(loginSchema) });

  const submit = handleSubmit(async (v) => {
    try { await login(v.userName, v.password); nav('/', { replace: true }); }
    catch (e) { toast.error(errorMessage(e)); }
  });

  return (
    <Shell title="Sign in" footer={<>New here? <Link className="font-semibold text-brand-700 underline" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-3">
        <Field id="userName" label="Username or email" autoComplete="username" error={errors.userName?.message} {...register('userName')} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <button className="btn w-full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Shell>
  );
}

const registerSchema = yup.object({
  displayName: yup.string().trim().required('Enter your name').max(50, 'Use 50 characters or fewer'),
  userName: yup.string().trim().required('Choose a username').min(3, 'Use at least 3 characters').max(32)
    .matches(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, dashes or underscores'),
  email: yup.string().trim().required('Enter your email').email('Enter a valid email'),
  password: yup.string().required('Choose a password').min(6, 'Use at least 6 characters').matches(/\d/, 'Include at least one number').matches(/[a-z]/, 'Include a lowercase letter'),
  confirm: yup.string().required('Repeat your password').oneOf([yup.ref('password')], 'Passwords do not match'),
});

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: yupResolver(registerSchema) });

  const submit = handleSubmit(async ({ confirm: _c, ...v }) => {
    try { await signUp(v); nav('/', { replace: true }); }
    catch (e) { toast.error(errorMessage(e)); }
  });

  return (
    <Shell title="Create account" footer={<>Already registered? <Link className="font-semibold text-brand-700 underline" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-3">
        <Field id="displayName" label="Display name" autoComplete="name" error={errors.displayName?.message} {...register('displayName')} />
        <Field id="userName" label="Username" autoComplete="username" error={errors.userName?.message} {...register('userName')} />
        <Field id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Field id="confirm" label="Repeat password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <button className="btn w-full" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create account'}</button>
      </form>
    </Shell>
  );
}
