/**
 * MIME email parsing utilities
 */

import { simpleParser } from "mailparser";
import { Readable } from "stream";
import { Attachment as ParsedAttachment } from "mailparser";
import { Attachment } from "@mailforge/shared";

export interface ParsedEmail {
  from?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  attachments: Attachment[];
  headers: Map<string, string | string[]>;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  priority?: "low" | "normal" | "high";
}

export async function parseMimeEmail(
  emailContent: Buffer
): Promise<ParsedEmail> {
  const stream = Readable.from([emailContent]);

  const parsed = await simpleParser(stream);

  // Parse recipients
  const from = Array.isArray(parsed.from?.value)
    ? parsed.from.value[0]?.address || ""
    : parsed.from?.value?.[0]?.address || "";

  const toAddresses = normalizeAddresses(parsed.to?.value || []);
  const ccAddresses = normalizeAddresses(parsed.cc?.value || []);
  const bccAddresses = normalizeAddresses(parsed.bcc?.value || []);

  // Parse body
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || "";

  // Parse attachments
  const attachments: Attachment[] = [];
  if (parsed.attachments && Array.isArray(parsed.attachments)) {
    for (const attachment of parsed.attachments) {
      if (attachment.content) {
        const buffer = Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(attachment.content);

        attachments.push({
          id: `att_${Math.random().toString(36).substr(2, 9)}`,
          filename: attachment.filename || "attachment",
          mimeType: attachment.contentType || "application/octet-stream",
          size: buffer.length,
          s3Key: "", // Will be set when uploaded to S3
          sha256: undefined, // Can be computed if needed
          scanStatus: "pending",
        });
      }
    }
  }

  // Parse headers
  const headers = new Map<string, string | string[]>();
  if (parsed.headers) {
    for (const [key, value] of parsed.headers.entries()) {
      headers.set(key.toLowerCase(), value);
    }
  }

  // Extract message ID and threading information
  const messageId = parsed.messageId || "";
  const inReplyTo = (parsed.inReplyTo as string | undefined) || undefined;
  const references = (parsed.references as string[]) || [];

  // Parse priority
  let priority: "low" | "normal" | "high" = "normal";
  const priorityHeader = parsed.headers?.get("priority");
  if (priorityHeader === "non-urgent" || priorityHeader === "5") {
    priority = "low";
  } else if (priorityHeader === "urgent" || priorityHeader === "1") {
    priority = "high";
  }

  return {
    from,
    to: toAddresses.length === 1 ? toAddresses[0] : toAddresses,
    cc: ccAddresses.length > 0 ? ccAddresses : undefined,
    bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
    subject: parsed.subject || "(No Subject)",
    textBody: textBody.substring(0, 100000), // Limit to 100KB
    htmlBody: htmlBody.substring(0, 500000), // Limit to 500KB
    attachments,
    headers,
    messageId,
    inReplyTo,
    references,
    priority,
  };
}

function normalizeAddresses(
  addresses: unknown[] | string | { address: string }[]
): string[] {
  if (!addresses) return [];
  if (typeof addresses === "string") return [addresses];
  if (Array.isArray(addresses)) {
    return addresses.flatMap((addr) => {
      if (typeof addr === "string") return [addr];
      if (addr && typeof addr === "object" && "address" in addr) {
        return [(addr as { address: string }).address];
      }
      return [];
    });
  }
  return [];
}

export function extractEmailAddresses(emailString: string): string[] {
  const emailRegex = /[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+/g;
  const matches = emailString.match(emailRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
}

export function createSimpleEmailHeaders(options: {
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options.messageId) {
    headers["Message-ID"] = options.messageId;
  }
  if (options.inReplyTo) {
    headers["In-Reply-To"] = options.inReplyTo;
  }
  if (options.references?.length) {
    headers["References"] = options.references.join(" ");
  }

  return headers;
}

export function sanitizeEmailBody(html: string): string {
  // Remove script tags and event handlers
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove event handlers from tags
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*"[^"]*"/gi, "");
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*'[^']*'/gi, "");

  // Remove potentially dangerous attributes
  sanitized = sanitized.replace(/\s*style\s*=\s*"[^"]*javascript:[^"]*"/gi, "");
  sanitized = sanitized.replace(/\s*href\s*=\s*"[^"]*javascript:[^"]*"/gi, "");

  return sanitized;
}

export interface EmailPreview {
  from: string;
  subject: string;
  preview: string;
  timestamp: number;
  hasAttachments: boolean;
  isRead: boolean;
  isStarred: boolean;
}

export function generateEmailPreview(
  from: string,
  subject: string,
  textBody: string,
  attachmentCount: number
): string {
  // Create a 150-character preview
  const preview = (textBody || "").substring(0, 150).trim();
  return preview || "(Empty message)";
}
