'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, Edit2, Trash2, ArrowLeft, Plus, Globe, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface Mailbox {
  id: string;
  localPart: string;
  displayName: string;
  domainId?: string;
  unreadCount: number;
  storageUsed: number;
}

interface Message {
  id: string;
  from: string;
  to: string[];
  subject: string;
  preview?: string;
  createdAt: number;
  isRead: boolean;
}

export default function OrganizationPage() {
  const [organizationId, setOrganizationId] = useState('');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mailboxes' | 'inbox' | 'compose'>('mailboxes');

  // New Mailbox modal / state
  const [showNewMailbox, setShowNewMailbox] = useState(false);
  const [newLocalPart, setNewLocalPart] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [mailboxError, setMailboxError] = useState('');
  const [mailboxCreating, setMailboxCreating] = useState(false);

  // Compose state
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [composeStatus, setComposeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        const items: Mailbox[] = data.items || [];
        setMailboxes(items);
        if (items.length > 0) {
          const firstEmail = items[0].domainId
            ? `${items[0].localPart}@${items[0].domainId}`
            : items[0].localPart;
          setComposeFrom(firstEmail);
          fetchMessages(items[0].id);
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

  const handleCreateMailbox = async () => {
    if (!newLocalPart.trim() || !newDomain.trim()) {
      setMailboxError('Please provide both local part and domain');
      return;
    }

    setMailboxCreating(true);
    setMailboxError('');
    try {
      const token = localStorage.getItem('token');
      const cleanDomain = newDomain.trim().toLowerCase().replace(/^@/, '');
      const cleanLocalPart = newLocalPart.trim().toLowerCase();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/organizations/${organizationId}/mailboxes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            domainId: cleanDomain,
            localPart: cleanLocalPart,
            displayName: newDisplayName.trim() || cleanLocalPart,
          }),
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error?.message || errJson?.message || 'Failed to create mailbox');
      }

      setNewLocalPart('');
      setNewDomain('');
      setNewDisplayName('');
      setShowNewMailbox(false);
      await fetchMailboxes();
    } catch (err) {
      setMailboxError(err instanceof Error ? err.message : 'Error creating mailbox');
    } finally {
      setMailboxCreating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!composeFrom.trim() || !composeTo.trim() || !composeSubject.trim()) {
      setComposeStatus({ type: 'error', message: 'From, To, and Subject are required.' });
      return;
    }

    setSending(true);
    setComposeStatus(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organizationId,
          from: composeFrom,
          to: composeTo.split(',').map((e) => e.trim()),
          subject: composeSubject,
          text: composeBody,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error?.message || errJson?.message || 'Failed to send email');
      }

      setComposeStatus({ type: 'success', message: 'Email queued for delivery successfully!' });
      setComposeSubject('');
      setComposeBody('');
    } catch (err) {
      setComposeStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error sending email',
      });
    } finally {
      setSending(false);
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
            <span className="font-semibold text-gray-900">Organization Mail</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          {(['mailboxes', 'inbox', 'compose'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setComposeStatus(null);
              }}
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
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Mailboxes & Domains</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Add mailboxes for your AWS SES-verified domain to send and receive emails.
                </p>
              </div>
              <button
                onClick={() => setShowNewMailbox(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Mailbox
              </button>
            </div>

            {showNewMailbox && (
              <div className="mb-8 p-6 bg-white rounded-lg shadow-md border-l-4 border-primary-600">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Add New Mailbox / Email Address</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Enter your address prefix and any domain already verified in your AWS SES account.
                </p>

                {mailboxError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                    {mailboxError}
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Local Part (Prefix)
                    </label>
                    <input
                      type="text"
                      placeholder="support or info"
                      value={newLocalPart}
                      onChange={(e) => setNewLocalPart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Verified SES Domain
                    </label>
                    <input
                      type="text"
                      placeholder="example.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="Support Team"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateMailbox}
                    disabled={mailboxCreating}
                    className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
                  >
                    {mailboxCreating ? 'Adding...' : 'Save Mailbox'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMailbox(false);
                      setMailboxError('');
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
              </div>
            ) : mailboxes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No mailboxes added yet</h3>
                <p className="text-gray-600 mb-6">
                  Add your verified SES domain and local address to start sending and receiving.
                </p>
                <button
                  onClick={() => setShowNewMailbox(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add First Mailbox
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {mailboxes.map((mb) => {
                  const fullEmail = mb.domainId ? `${mb.localPart}@${mb.domainId}` : mb.localPart;
                  return (
                    <div
                      key={mb.id}
                      className="p-6 bg-white rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{mb.displayName}</h3>
                          <p className="text-primary-700 font-mono text-sm font-medium mt-1">{fullEmail}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-green-100 text-green-700 font-medium rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded">
                        <div>
                          <p className="text-gray-500 text-xs">Unread Messages</p>
                          <p className="text-xl font-bold text-gray-900">{mb.unreadCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Storage Used</p>
                          <p className="text-sm font-medium text-gray-800 mt-1">
                            {(mb.storageUsed / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            setComposeFrom(fullEmail);
                            setTab('compose');
                          }}
                          className="flex-1 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 text-sm font-medium flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-4 h-4" />
                          Compose from this
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Inbox Tab */}
        {tab === 'inbox' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Inbox</h2>
            {messages.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages</h3>
                <p className="text-gray-600">Your inbox is empty</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden divide-y divide-gray-100">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={msg.isRead ? 'text-gray-600 font-medium' : 'font-bold text-gray-900'}>
                        {msg.from}
                      </p>
                      <p className={msg.isRead ? 'text-gray-700 text-sm' : 'text-gray-900 text-sm font-semibold'}>
                        {msg.subject}
                      </p>
                      {msg.preview && (
                        <p className="text-gray-500 text-sm mt-1 truncate">{msg.preview}</p>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs whitespace-nowrap">
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
          <div className="max-w-2xl bg-white p-6 rounded-lg shadow-sm space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Compose Email</h2>

            {composeStatus && (
              <div
                className={`p-4 rounded-lg text-sm border ${
                  composeStatus.type === 'success'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {composeStatus.message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              {mailboxes.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={composeFrom}
                    onChange={(e) => setComposeFrom(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                  >
                    {mailboxes.map((mb) => {
                      const addr = mb.domainId ? `${mb.localPart}@${mb.domainId}` : mb.localPart;
                      return (
                        <option key={mb.id} value={addr}>
                          {mb.displayName} ({addr})
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-gray-500">Or type any custom sender address below:</p>
                  <input
                    type="text"
                    value={composeFrom}
                    onChange={(e) => setComposeFrom(e.target.value)}
                    placeholder="user@your-ses-domain.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={composeFrom}
                    onChange={(e) => setComposeFrom(e.target.value)}
                    placeholder="you@your-ses-domain.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter any email with a domain verified in your AWS SES.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message here..."
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex-1 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              >
                <Send className="w-5 h-5" />
                {sending ? 'Sending via SES...' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
