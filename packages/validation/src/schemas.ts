import { z } from "zod";

/**
 * Validation schemas for MailForge
 */

// === Organization ===
export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  plan: z.enum(["free", "pro", "business"]).optional().default("free"),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  plan: z.enum(["free", "pro", "business"]).optional(),
});

// === Domains ===
export const CreateDomainSchema = z.object({
  domainName: z
    .string()
    .min(3)
    .max(255)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i, "Invalid domain format"),
});

export const VerifyDomainSchema = z.object({
  dnsRecords: z.object({
    verification: z.string().optional(),
    dkim: z.array(z.string()).optional(),
    spf: z.string().optional(),
    dmarc: z.string().optional(),
  }),
});

// === Mailboxes ===
export const CreateMailboxSchema = z.object({
  domainId: z.string().min(1),
  localPart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._%-]+$/, "Invalid local part"),
  displayName: z.string().min(1).max(255),
  storageQuota: z.number().positive().optional(),
});

export const UpdateMailboxSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  storageQuota: z.number().positive().optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
});

export const CreateMailboxAliasSchema = z.object({
  mailboxId: z.string().min(1),
  localPart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._%-]+$/, "Invalid local part"),
});

// === Messages ===
export const SendEmailSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1).max(50),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(255),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
  replyToMessageId: z.string().optional(),
  replyToAll: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

export const CreateDraftSchema = z.object({
  mailboxId: z.string().min(1),
  from: z.string().email().optional(),
  to: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().optional(),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
});

export const GetMessagesSchema = z.object({
  mailboxId: z.string().min(1),
  folder: z
    .enum(["inbox", "sent", "drafts", "archive", "spam", "trash"])
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  hasAttachment: z.boolean().optional(),
  isRead: z.boolean().optional(),
  dateFrom: z.number().optional(),
  dateTo: z.number().optional(),
});

export const MarkMessageSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isSpam: z.boolean().optional(),
  isTrashed: z.boolean().optional(),
});

// === API Keys ===
export const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(
    z.enum([
      "emails:send",
      "emails:read",
      "domains:read",
      "domains:manage",
      "mailboxes:read",
      "mailboxes:manage",
      "webhooks:read",
      "webhooks:manage",
      "messages:read",
      "messages:write",
    ])
  ),
  expiresAt: z.number().optional(),
});

// === Webhooks ===
export const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      "email.received",
      "email.sent",
      "email.delivered",
      "email.bounced",
      "email.complained",
      "email.failed",
      "mailbox.created",
      "mailbox.deleted",
      "domain.verified",
      "domain.verification_failed",
    ])
  ),
});

export const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z
    .array(
      z.enum([
        "email.received",
        "email.sent",
        "email.delivered",
        "email.bounced",
        "email.complained",
        "email.failed",
        "mailbox.created",
        "mailbox.deleted",
        "domain.verified",
        "domain.verification_failed",
      ])
    )
    .optional(),
  isActive: z.boolean().optional(),
});

// === Authentication ===
export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[!@#$%^&*]/, "Must contain special character"),
  name: z.string().min(1).max(255),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
});

// === Team Management ===
export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "developer", "member", "viewer"]),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["admin", "developer", "member", "viewer"]),
});

// === Type Exports ===
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;
export type CreateDomain = z.infer<typeof CreateDomainSchema>;
export type VerifyDomain = z.infer<typeof VerifyDomainSchema>;
export type CreateMailbox = z.infer<typeof CreateMailboxSchema>;
export type UpdateMailbox = z.infer<typeof UpdateMailboxSchema>;
export type CreateMailboxAlias = z.infer<typeof CreateMailboxAliasSchema>;
export type SendEmail = z.infer<typeof SendEmailSchema>;
export type CreateDraft = z.infer<typeof CreateDraftSchema>;
export type GetMessages = z.infer<typeof GetMessagesSchema>;
export type MarkMessage = z.infer<typeof MarkMessageSchema>;
export type CreateAPIKey = z.infer<typeof CreateAPIKeySchema>;
export type CreateWebhook = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhook = z.infer<typeof UpdateWebhookSchema>;
export type SignUp = z.infer<typeof SignUpSchema>;
export type SignIn = z.infer<typeof SignInSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type InviteMember = z.infer<typeof InviteMemberSchema>;
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>;
