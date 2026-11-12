'use client';

import { useState, useEffect } from 'react';
import { Mail, Settings, LogOut, Plus, Search } from 'lucide-react';
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
    window.location.href = '/auth/sign-in';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">MailForge</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" className="text-gray-600 hover:text-gray-900">
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
            <p className="text-gray-600 mt-2">Manage your email organizations</p>
          </div>
          <button
            onClick={() => setShowNewOrg(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            New Organization
          </button>
        </div>

        {showNewOrg && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md border-l-4 border-primary-600">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Organization</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <button
                onClick={createOrganization}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewOrg(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
            <p className="text-gray-600 mt-4">Loading organizations...</p>
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No organizations yet</h3>
            <p className="text-gray-600 mb-6">Create your first organization to get started</p>
            <button
              onClick={() => setShowNewOrg(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5" />
              Create Organization
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/dashboard/orgs?id=${encodeURIComponent(org.id)}`}
                className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 hover:border-primary-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Plan: {org.plan}</p>
                  </div>
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                    {org.plan}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Created {new Date(org.createdAt * 1000).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
