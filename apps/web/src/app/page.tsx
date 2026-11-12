'use client';

import Link from 'next/link';
import { Mail, Lock, Zap, Globe } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">MailForge</span>
          </div>
          <div className="flex gap-4">
            <Link href="/auth/sign-in" className="px-4 py-2 text-primary-600 hover:text-primary-700 font-medium">
              Sign In
            </Link>
            <Link href="/auth/sign-up" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Serverless Email Hosting
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Send and receive emails from your custom domains using AWS SES
          </p>
          <Link
            href="/auth/sign-up"
            className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            Get Started For Free
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          {[
            {
              icon: Zap,
              title: 'Lightning Fast',
              description: 'Emails delivered in milliseconds via AWS SES',
            },
            {
              icon: Globe,
              title: 'Custom Domains',
              description: 'Send emails from your own domain',
            },
            {
              icon: Lock,
              title: 'Secure & Private',
              description: 'Encrypted storage and direct AWS transmission',
            },
            {
              icon: Mail,
              title: '100% Free & Open',
              description: 'Run completely on your own AWS free tier resources',
            },
          ].map((feature, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <feature.icon className="w-8 h-8 text-primary-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Free & Open Source Banner */}
      <section className="bg-white py-16 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 bg-green-100 text-green-800 text-sm font-semibold rounded-full mb-4">
            100% Free & Open Source
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Zero Subscriptions. No Hidden Costs.
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            MailForge is self-hosted on your own AWS account. Pay nothing to us — you only utilize standard AWS free-tier services.
          </p>
          <Link
            href="/auth/sign-up"
            className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}
