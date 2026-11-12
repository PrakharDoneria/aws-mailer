/**
 * Shared types for MailForge platform
 */

// === Organization ===
export interface Organization {
  id: string;
  ownerId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: "free" | "pro" | "business";
  status: "active" | "suspended";
}

// === Users and Membership ===
export type UserRole = "owner" | "admin" | "developer" | "member" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  lastLogin?: number;
  status: "active" | "inactive";
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  createdAt: number;
}

// === Domains ===
export type DomainStatus = "pending" | "verified" | "failed";

export interface Domain {
  id: string;
  organizationId: string;
  domainName: string;
  status: DomainStatus;
  verificationToken?: string;
  verifiedAt?: number;
  dkimStatus?: "pending" | "verified" | "failed";
  spfStatus?: "pending" | "verified" | "failed";
  dmarcStatus?: "pending" | "verified" | "failed";
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DomainDNSRecords {
  verification: {
    type: "TXT";
    name: string;
    value: string;
    required: boolean;
  };
  dkim: Array<{
    type: "CNAME";
    name: string;
    value: string;
    required: boolean;
  }>;
  spf: {
    type: "TXT";
    name: string;
    value: string;
    required: boolean;
  };
  dmarc: {
    type: "TXT";
    name: string;
    value: string;
    required: boolean;
  };
  mx: {
    type: "MX";
    name: string;
    value: string;
    priority: number;
    required: boolean;
  };
  mailFrom?: {
    type: "MX";
    name: string;
    value: string;
    priority: number;
    required: boolean;
  };
}

// === Mailboxes ===
export type MailboxStatus = "active" | "suspended" | "archived";

export interface Mailbox {
  id: string;
  organizationId: string;
  domainId: string;
  localPart: string; // e.g., "hello" in "hello@example.com"
  displayName: string;
  status: MailboxStatus;
  storageQuota: number; // in bytes
  storageUsed: number;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MailboxAlias {
  id: string;
  organizationId: string;
  mailboxId: string;
  localPart: string; // e.g., "contact" for "contact@example.com"
  domainId: string;
  createdAt: number;
}

// === Messages ===
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus =
  | "draft"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "rejected"
  | "complained";

export interface Message {
  id: string;
  organizationId: string;
  mailboxId: string;
  messageId: string; // RFC 5322 Message-ID or SES MessageId
  direction: MessageDirection;
  status: MessageStatus;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  preview?: string;
  textBody?: string;
  htmlBody?: string;
  rawEmailS3Key?: string; // S3 key for full MIME message
  attachments: Attachment[];
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isSpam: boolean;
  isTrashed: boolean;
  receivedAt?: number;
  sentAt?: number;
  headers?: Record<string, string | string[]>;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  s3Key: string; // S3 key for attachment content
  sha256?: string;
  scanStatus?: "pending" | "clean" | "quarantined";
}

export interface MessageEvent {
  type: "bounce" | "complaint" | "delivery" | "send" | "reject";
  messageId: string;
  organizationId: string;
  mailboxId?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// === API Keys ===
export interface APIKey {
  id: string;
  organizationId: string;
  name: string;
  keyHash: string; // SHA256 hash of the actual key
  lastUsedAt?: number;
  createdAt: number;
  expiresAt?: number;
  permissions: APIKeyPermission[];
  revokedAt?: number;
}

export type APIKeyPermission =
  | "emails:send"
  | "emails:read"
  | "domains:read"
  | "domains:manage"
  | "mailboxes:read"
  | "mailboxes:manage"
  | "webhooks:read"
  | "webhooks:manage"
  | "messages:read"
  | "messages:write";

// === Webhooks ===
export type WebhookEvent =
  | "email.received"
  | "email.sent"
  | "email.delivered"
  | "email.bounced"
  | "email.complained"
  | "email.failed"
  | "mailbox.created"
  | "mailbox.deleted"
  | "domain.verified"
  | "domain.verification_failed";

export interface Webhook {
  id: string;
  organizationId: string;
  url: string;
  events: WebhookEvent[];
  secret: string; // Used for HMAC signature
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEvent;
  payload: unknown;
  responseStatus?: number;
  responseBody?: string;
  attemptCount: number;
  nextRetryAt?: number;
  failedAt?: number;
  succeededAt?: number;
  createdAt: number;
}

// === API Responses ===
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// === Usage and Analytics ===
export interface UsageRecord {
  organizationId: string;
  date: string; // YYYY-MM-DD
  emailsSent: number;
  emailsReceived: number;
  storageUsed: number;
  attachmentStorageUsed: number;
  apiRequests: number;
}

export interface OrgUsageLimits {
  domainsMax: number;
  mailboxesMax: number;
  storageMax: number; // in bytes
  emailsPerDay: number;
  apiRequestsPerHour: number;
}

// === Errors ===
export class MailForgeError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MailForgeError";
  }
}

export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_API_KEY: "INVALID_API_KEY",

  // Validation
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_DOMAIN: "INVALID_DOMAIN",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Limits
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  RATE_LIMITED: "RATE_LIMITED",
  PLAN_LIMIT: "PLAN_LIMIT",

  // Email specific
  EMAIL_SEND_FAILED: "EMAIL_SEND_FAILED",
  DOMAIN_VERIFICATION_FAILED: "DOMAIN_VERIFICATION_FAILED",
  INVALID_RECIPIENT: "INVALID_RECIPIENT",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;
