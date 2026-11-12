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
            Start Free Trial
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
              title: 'Secure',
              description: 'Encrypted storage and transmission',
            },
            {
              icon: Mail,
              title: 'Full Control',
              description: 'REST API and webmail dashboard',
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

      {/* Pricing Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Simple Pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Free',
                price: '$0',
                domains: '1 domain',
                mailboxes: '3 mailboxes',
                emails: '100 emails/day',
              },
              {
                name: 'Pro',
                price: '$29',
                domains: '5 domains',
                mailboxes: '25 mailboxes',
                emails: '10,000 emails/day',
                featured: true,
              },
              {
                name: 'Business',
                price: '$99',
                domains: '20 domains',
                mailboxes: '200 mailboxes',
                emails: '100,000 emails/day',
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`p-8 rounded-lg border-2 ${
                  plan.featured
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-4xl font-bold text-primary-600 mb-6">
                  {plan.price}
                  <span className="text-lg text-gray-600">/month</span>
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="text-gray-700">✓ {plan.domains}</li>
                  <li className="text-gray-700">✓ {plan.mailboxes}</li>
                  <li className="text-gray-700">✓ {plan.emails}</li>
                </ul>
                <button
                  className={`w-full py-2 rounded-lg font-medium transition-colors ${
                    plan.featured
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'border-2 border-gray-200 text-gray-900 hover:border-gray-300'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
