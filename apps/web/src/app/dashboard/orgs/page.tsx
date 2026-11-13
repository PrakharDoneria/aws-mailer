'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Mailbox {
  id: string;
  localPart: string;
  displayName: string;
  unreadCount: number;
  storageUsed: number;
}

interface Message {
  id: string;
  from: string;
  subject: string;
  preview?: string;
  createdAt: number;
  isRead: boolean;
}

export default function OrganizationPage() {
  const [organizationId, setOrganizationId] = useState('');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mailboxes' | 'inbox' | 'compose'>('mailboxes');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/sign-in/';
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get('id') || params.get('orgId') || '';
    setOrganizationId(orgId);
  }, []);

  useEffect(() => {
    if (organizationId) {
      fetchMailboxes();
    } else {
      setLoading(false);
    }
  }, [organizationId]);

  const fetchMailboxes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/organizations/${organizationId}/mailboxes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const { data } = await response.json();
        setMailboxes(data.items || []);
        if (data.items?.[0]) {
          setSelectedMailbox(data.items[0].id);
          fetchMessages(data.items[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch mailboxes', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (mailboxId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/messages?mailboxId=${mailboxId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const { data } = await response.json();
        setMessages(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard/" className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
            <ArrowLeft className="w-5 h-5" />
            Back to Organizations
          </Link>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-gray-900">Organization</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          {(['mailboxes', 'inbox', 'compose'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Mailboxes Tab */}
        {tab === 'mailboxes' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Mailboxes</h2>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
              </div>
            ) : mailboxes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No mailboxes</h3>
                <p className="text-gray-600">Create a mailbox to start sending and receiving emails</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {mailboxes.map((mb) => (
                  <div
                    key={mb.id}
                    className="p-6 bg-white rounded-lg shadow-sm border border-gray-200"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">{mb.displayName}</h3>
                    <p className="text-gray-600 mt-1">{mb.localPart}</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Unread</p>
                        <p className="text-2xl font-bold text-primary-600">{mb.unreadCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Storage</p>
                        <p className="text-sm text-gray-900">
                          {(mb.storageUsed / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 px-3 py-2 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 flex items-center justify-center gap-2 text-sm">
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button className="flex-1 px-3 py-2 border border-red-200 text-red-700 rounded hover:bg-red-50 flex items-center justify-center gap-2 text-sm">
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inbox Tab */}
        {tab === 'inbox' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Inbox</h2>
            {messages.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages</h3>
                <p className="text-gray-600">Your inbox is empty</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer flex gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={msg.isRead ? 'text-gray-600' : 'font-semibold text-gray-900'}>
                        {msg.from}
                      </p>
                      <p className={msg.isRead ? 'text-gray-600 text-sm' : 'text-gray-900 text-sm'}>
                        {msg.subject}
                      </p>
                      {msg.preview && (
                        <p className="text-gray-600 text-sm mt-1 truncate">{msg.preview}</p>
                      )}
                    </div>
                    <p className="text-gray-600 text-xs whitespace-nowrap">
                      {new Date(msg.createdAt * 1000).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compose Tab */}
        {tab === 'compose' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Compose Email</h2>
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                  {mailboxes.map((mb) => (
                    <option key={mb.id} value={mb.localPart}>
                      {mb.displayName} ({mb.localPart})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Email subject"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  placeholder="Write your message here..."
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-4">
                <button className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  Send
                </button>
                <button className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Save Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
