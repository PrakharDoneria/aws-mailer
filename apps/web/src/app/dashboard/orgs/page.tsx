'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, ArrowLeft, Plus, CheckCircle2, RefreshCw, X, Calendar } from 'lucide-react';
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
  mailboxId?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  preview?: string;
  createdAt: number;
  isRead: boolean;
}

export default function OrganizationPage() {
  const [organizationId, setOrganizationId] = useState('');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mailboxes' | 'inbox' | 'compose'>('mailboxes');

  // Popup modal for viewing full email
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);

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
          setSelectedMailboxId(items[0].id);
          fetchMessages(items[0].id);
        } else {
          fetchMessages();
        }
      }
    } catch (err) {
      console.error('Failed to fetch mailboxes', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (mailboxId?: string) => {
    try {
      const token = localStorage.getItem('token');
      const queryParam = mailboxId
        ? `mailboxId=${mailboxId}`
        : `organizationId=${organizationId}`;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/messages?${queryParam}`,
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

  const handleOpenMessage = async (msg: Message) => {
    setActiveMessage(msg);
    // Optionally fetch full message details if bodies are truncated
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const fullData = await res.json();
        if (fullData.data) {
          setActiveMessage(fullData.data);
        }
      }
    } catch (e) {
      console.warn("Could not load full message details", e);
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
          textBody: composeBody,
          htmlBody: composeBody ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${composeBody}</div>` : '',
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error?.message || errJson?.message || 'Failed to send email');
      }

      setComposeStatus({ type: 'success', message: 'Email queued for delivery successfully via SES!' });
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
    <div className="app-shell">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/dashboard/" className="flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:text-primary-700">
            <ArrowLeft className="w-5 h-5" />
            Back to Organizations
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-600 text-white"><Mail className="h-4 w-4" /></span>
            <span className="font-extrabold tracking-tight text-slate-950">MailForge</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Tabs */}
        <div className="mb-10 flex w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
          {(['mailboxes', 'inbox', 'compose'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setComposeStatus(null);
                if (t === 'inbox') {
                  fetchMessages(selectedMailboxId);
                }
              }}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none ${
                tab === t
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Mailboxes Tab */}
        {tab === 'mailboxes' && (
          <div>
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Organization</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">Mailboxes & addresses</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Mailboxes mapped to your AWS SES verified domains.
                </p>
              </div>
              <button
                onClick={() => setShowNewMailbox(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                Add Mailbox
              </button>
            </div>

            {showNewMailbox && (
              <div className="surface mb-8 border-l-4 border-l-primary-600 p-6">
                <h3 className="text-lg font-bold text-slate-950">Add a mailbox</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Enter your address prefix and any domain verified in your AWS SES.
                </p>

                {mailboxError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                    {mailboxError}
                  </div>
                )}

                <div className="mb-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Local Part (Prefix)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. test or support"
                      value={newLocalPart}
                      onChange={(e) => setNewLocalPart(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Verified SES Domain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. testmailer.sblab.xyz"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="My Team"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateMailbox}
                    disabled={mailboxCreating}
                    className="btn-primary"
                  >
                    {mailboxCreating ? 'Adding...' : 'Save Mailbox'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMailbox(false);
                      setMailboxError('');
                    }}
                    className="btn-secondary"
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
              <div className="surface px-6 py-16 text-center">
                <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary-50 text-primary-600"><Mail className="h-8 w-8" /></span>
                <h3 className="text-lg font-bold text-slate-950">No mailboxes yet</h3>
                <p className="mx-auto mt-2 max-w-md text-slate-600">
                  Add your verified SES domain and local address to start sending and receiving.
                </p>
                <button
                  onClick={() => setShowNewMailbox(true)}
                  className="btn-primary mt-6"
                >
                  <Plus className="w-4 h-4" />
                  Add First Mailbox
                </button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {mailboxes.map((mb) => {
                  const fullEmail = mb.domainId ? `${mb.localPart}@${mb.domainId}` : mb.localPart;
                  return (
                    <div
                      key={mb.id}
                      className="surface p-6"
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

                      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
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
                        <button
                          onClick={() => {
                            setSelectedMailboxId(mb.id);
                            setTab('inbox');
                            fetchMessages(mb.id);
                          }}
                          className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                        >
                          View Inbox
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
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900">Inbox</h2>
                {mailboxes.length > 0 && (
                  <select
                    value={selectedMailboxId}
                    onChange={(e) => {
                      setSelectedMailboxId(e.target.value);
                      fetchMessages(e.target.value);
                    }}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">All Mailboxes in Org</option>
                    {mailboxes.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.displayName} ({mb.localPart}@{mb.domainId})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                onClick={() => fetchMessages(selectedMailboxId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages</h3>
                <p className="text-gray-600 text-sm max-w-md mx-auto">
                  Your inbox is waiting for incoming emails. Ensure your SES Inbound Receipt Rule forwards to S3/SNS.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden divide-y divide-gray-100 border border-gray-200">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleOpenMessage(msg)}
                    className="p-4 hover:bg-blue-50/50 transition-colors cursor-pointer flex gap-4 items-center"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${msg.isRead ? 'text-gray-600' : 'font-bold text-gray-900'}`}>
                          {msg.from}
                        </span>
                      </div>
                      <p className={`text-sm mt-0.5 ${msg.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                        {msg.subject || '(No Subject)'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1 truncate">
                        {msg.textBody || msg.preview || 'Click to view email body'}
                      </p>
                    </div>
                    <span className="text-gray-400 text-xs whitespace-nowrap">
                      {new Date(msg.createdAt * 1000).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compose Tab */}
        {tab === 'compose' && (
          <div className="max-w-2xl bg-white p-6 rounded-lg shadow-sm space-y-4 border border-gray-200">
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
                  <p className="text-xs text-gray-500">Or type custom sender address below:</p>
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

      {/* Full Message View Modal Pop-up */}
      {activeMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50">
              <div className="min-w-0 pr-4">
                <h3 className="text-xl font-bold text-gray-900 break-words">
                  {activeMessage.subject || '(No Subject)'}
                </h3>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">From:</span>
                    <span className="text-primary-700 font-medium">{activeMessage.from}</span>
                  </div>
                  {activeMessage.to && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">To:</span>
                      <span>{Array.isArray(activeMessage.to) ? activeMessage.to.join(', ') : activeMessage.to}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(activeMessage.createdAt * 1000).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveMessage(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 text-gray-800 leading-relaxed">
              {activeMessage.htmlBody ? (
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: activeMessage.htmlBody }}
                />
              ) : activeMessage.textBody ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                  {activeMessage.textBody}
                </pre>
              ) : (
                <p className="text-gray-400 italic">This email has no text or HTML content.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setComposeTo(activeMessage.from);
                  setComposeSubject(`Re: ${activeMessage.subject || ''}`);
                  setActiveMessage(null);
                  setTab('compose');
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Reply
              </button>
              <button
                onClick={() => setActiveMessage(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
