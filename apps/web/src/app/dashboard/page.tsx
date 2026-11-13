'use client';

import { useState, useEffect } from 'react';
import { Mail, Settings, LogOut, Plus, ArrowRight, Building2 } from 'lucide-react';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
  plan: string;
  createdAt: number;
}

export default function Dashboard() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/sign-in/';
      return;
    }
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const { data } = await response.json();
        setOrgs(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch organizations', err);
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newOrgName }),
      });

      if (response.ok) {
        setNewOrgName('');
        setShowNewOrg(false);
        fetchOrganizations();
      }
    } catch (err) {
      console.error('Failed to create organization', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/auth/sign-in/';
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-600 text-white"><Mail className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight text-slate-950">MailForge</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard/settings" aria-label="Settings" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Your organizations</h1>
            <p className="mt-2 text-slate-600">Set up and manage the homes for your email domains.</p>
          </div>
          <button
            onClick={() => setShowNewOrg(true)}
            className="btn-primary"
          >
            <Plus className="w-5 h-5" />
            New Organization
          </button>
        </div>

        {showNewOrg && (
          <div className="surface mb-8 border-l-4 border-l-primary-600 p-6">
            <h3 className="text-lg font-bold text-slate-950">Create an organization</h3><p className="mt-1 text-sm text-slate-500">Give your team a distinct place to manage mailboxes.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="field flex-1"
              />
              <button
                onClick={createOrganization}
                className="btn-primary"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewOrg(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
            <p className="text-gray-600 mt-4">Loading organizations...</p>
          </div>
        ) : orgs.length === 0 ? (
          <div className="surface px-6 py-16 text-center">
            <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary-50 text-primary-600"><Building2 className="h-8 w-8" /></span>
            <h3 className="text-xl font-bold text-slate-950">Create your first organization</h3>
            <p className="mx-auto mt-2 max-w-sm text-slate-600">Organizations keep your domains, mailboxes, and messages neatly separated.</p>
            <button
              onClick={() => setShowNewOrg(true)}
              className="btn-primary mt-6 px-5 py-3"
            >
              <Plus className="w-5 h-5" />
              Create Organization
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/dashboard/orgs?id=${encodeURIComponent(org.id)}`}
                className="surface group p-6 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-950">{org.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">Email workspace</p>
                  </div>
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                    {org.plan}
                  </span>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">
                  Created {new Date(org.createdAt * 1000).toLocaleDateString()}
                </p><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-primary-600" /></div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
