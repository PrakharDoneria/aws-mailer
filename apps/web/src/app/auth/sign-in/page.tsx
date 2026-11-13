'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type SignInForm = z.infer<typeof signInSchema>;

export default function SignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInForm) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const serverMessage = errorData?.error?.message || errorData?.message;
        throw new Error(serverMessage || `Sign in failed (${response.status})`);
      }

      const { data: result } = await response.json();
      const token = result.idToken || result.accessToken || result.token;
      localStorage.setItem('token', token);
      window.location.href = '/dashboard/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary-700"><Mail className="h-4 w-4" /> MailForge</Link>
      <div className="surface p-6 sm:p-8">
        <div className="text-center mb-8">
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/20"><Mail className="h-6 w-6" /></span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Welcome back</h1>
          <p className="mt-2 text-slate-600">Sign in to manage your mailboxes.</p>
        </div>

        {error && (
          <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="field pl-11"
              />
            </div>
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="field pl-11"
              />
            </div>
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link href="/auth/sign-up" className="text-primary-600 font-medium hover:text-primary-700">
            Create one
          </Link>
        </p></div>
      </div>
    </div>
  );
}
