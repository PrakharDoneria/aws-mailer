/**
 * Shared utility functions
 */

import { createHash, randomBytes } from "crypto";

export function generateId(): string {
  return randomBytes(16).toString("hex");
}

export function generateAPIKey(): string {
  return "mf_" + randomBytes(32).toString("hex");
}

export function hashAPIKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidEmail(email: string): boolean {
  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$|^[^\s@]+@[^\s@]+$|^"[^"\\]*"@[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function isValidDomain(domain: string): boolean {
  // Basic domain validation
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain) && domain.length <= 255;
}

export function getLocalPart(email: string): string | null {
  const match = email.match(/^([^@]+)@/);
  return match ? match[1] : null;
}

export function getDomainFromEmail(email: string): string | null {
  const match = email.match(/@(.+)$/);
  return match ? match[1] : null;
}

export function sanitizeHTML(html: string): string {
  // Basic HTML sanitization - for production use DOMPurify or similar
  // This is a placeholder
  return html.replace(/<script[^>]*>.*?<\/script>/gi, "");
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateHMACSignature(
  payload: string,
  secret: string
): string {
  const hmac = require("crypto").createHmac("sha256", secret);
  return hmac.update(payload).digest("hex");
}

export function getExponentialBackoff(
  attemptNumber: number,
  baseDelaySeconds: number = 60,
  maxDelaySeconds: number = 3600
): number {
  const delay = baseDelaySeconds * Math.pow(2, attemptNumber);
  return Math.min(delay, maxDelaySeconds);
}

export function getPaginationParams(
  page?: string | number,
  limit?: string | number,
  maxLimit: number = 100
): { offset: number; limit: number } {
  const pageNum = Math.max(1, parseInt(String(page || 1), 10));
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(String(limit || 20), 10)));
  return {
    offset: (pageNum - 1) * limitNum,
    limit: limitNum,
  };
}

export function buildEmailAddress(
  localPart: string,
  domain: string
): string {
  return `${localPart}@${domain}`;
}
