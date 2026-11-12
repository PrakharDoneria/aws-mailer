/**
 * Shared constants for MailForge
 */

export const PLANS = {
  FREE: {
    name: "free",
    domainsMax: 1,
    mailboxesMax: 3,
    storageBytesMax: 1 * 1024 * 1024 * 1024, // 1GB
    emailsPerDay: 100,
    apiRequestsPerHour: 60,
  },
  PRO: {
    name: "pro",
    domainsMax: 5,
    mailboxesMax: 25,
    storageBytesMax: 50 * 1024 * 1024 * 1024, // 50GB
    emailsPerDay: 10000,
    apiRequestsPerHour: 3600,
  },
  BUSINESS: {
    name: "business",
    domainsMax: 20,
    mailboxesMax: 200,
    storageBytesMax: 500 * 1024 * 1024 * 1024, // 500GB
    emailsPerDay: 100000,
    apiRequestsPerHour: 36000,
  },
} as const;

export const SES_REGION = "us-east-1"; // SES is limited to specific regions

export const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024 * 1024; // 5GB per mailbox

export const SQS_VISIBILITY_TIMEOUT = 300; // 5 minutes

export const WEBHOOK_MAX_RETRIES = 5;
export const WEBHOOK_RETRY_BACKOFF_BASE = 60; // seconds

export const MESSAGE_MAX_SIZE = 25 * 1024 * 1024; // 25MB (SES limit)

export const ATTACHMENT_MAX_SIZE = 40 * 1024 * 1024; // 40MB per attachment
export const ATTACHMENT_MAX_COUNT = 50; // Max attachments per email

export const MAX_EMAIL_RECIPIENTS = 50; // SES default

export const COGNITO_PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
} as const;

export const API_KEY_PREFIX = "mf_"; // MailForge API key prefix
export const API_KEY_LENGTH = 32; // Random bytes for API key

export const IDEMPOTENCY_KEY_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

export const DLQ_MAX_MESSAGE_AGE = 14 * 24 * 60 * 60; // 14 days in seconds
