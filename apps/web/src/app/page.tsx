'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Globe2, LockKeyhole, Mail, Send, ShieldCheck, Sparkles, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="app-shell overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5 text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-600 text-white shadow-lg shadow-primary-600/25"><Mail className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight">MailForge</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth/sign-in" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 sm:px-4">
              Sign In
            </Link>
            <Link href="/auth/sign-up" className="btn-primary px-3 py-2 text-sm sm:px-4">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:pb-28">
        <div className="absolute left-1/2 top-0 -z-0 h-[30rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="relative z-[1] mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/90 px-3.5 py-2 text-sm font-semibold text-primary-700 shadow-sm"><Sparkles className="h-4 w-4" /> Email infrastructure, simplified</div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Email that feels <span className="text-primary-600">entirely yours.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-600 sm:text-xl">
            Run professional email for your domains on AWS SES—with an interface your team will actually enjoy using.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth/sign-up" className="btn-primary px-6 py-3.5 text-base">Create your workspace <ArrowRight className="h-4 w-4" /></Link><Link href="/auth/sign-in" className="btn-secondary px-6 py-3.5 text-base">Sign in to MailForge</Link></div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-500">{['Free to self-host', 'Uses your AWS account', 'No credit card required'].map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{item}</span>)}</div>
        </div>

        <div className="relative z-[1] mx-auto mt-16 max-w-5xl rounded-[1.5rem] border border-slate-200 bg-slate-950 p-2 shadow-2xl shadow-slate-900/15"><div className="overflow-hidden rounded-[1.1rem] bg-slate-900 p-5 sm:p-8"><div className="mb-7 flex items-center justify-between border-b border-slate-700 pb-5"><div className="flex items-center gap-2 text-sm font-semibold text-white"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> All systems operational</div><span className="text-xs text-slate-400">mailforge workspace</span></div><div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]"><div className="rounded-xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-900">support@acme.co</p><p className="mt-1 text-xs text-slate-500">Primary mailbox</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span></div><div className="mt-5 space-y-2">{['Product question from Mia', 'Your AWS SES domain is verified', 'Welcome to your new inbox'].map((email, index) => <div key={email} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"><span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-primary-500' : 'bg-slate-200'}`} /><p className="text-sm text-slate-600">{email}</p></div>)}</div></div><div className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-white"><Send className="h-5 w-5 text-primary-300" /><p className="mt-7 text-3xl font-extrabold">One inbox.</p><p className="mt-1 text-3xl font-extrabold text-primary-300">Every domain.</p><p className="mt-5 text-sm leading-6 text-slate-400">Manage mailboxes, send messages, and see what matters from one calm workspace.</p></div></div></div></div>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: 'Lightning Fast',
              description: 'Emails delivered in milliseconds via AWS SES',
            },
            {
              icon: Globe2,
              title: 'Custom Domains',
              description: 'Send emails from your own domain',
            },
            {
              icon: LockKeyhole,
              title: 'Secure & Private',
              description: 'Encrypted storage and direct AWS transmission',
            },
          ].map((feature, i) => (
            <div key={i} className="surface p-6 sm:p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-600"><feature.icon className="h-5 w-5" /></span>
              <h3 className="mt-5 text-lg font-bold text-slate-950">
                {feature.title}
              </h3>
              <p className="mt-2 leading-7 text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Free & Open Source Banner */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="rounded-3xl bg-primary-700 px-6 py-12 text-center text-white shadow-xl shadow-primary-700/20 sm:px-12">
          <ShieldCheck className="mx-auto h-9 w-9 text-primary-200" />
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Own your sending stack.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-100">
            MailForge is open source and runs within your AWS account. No subscriptions, no platform lock-in.
          </p>
          <Link
            href="/auth/sign-up"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-primary-700 shadow-lg hover:bg-primary-50"
          >
            Get started for free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
