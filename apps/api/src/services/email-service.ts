import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  Message,
  MailForgeError,
  ErrorCodes,
  generateId,
  getCurrentTimestamp,
  isValidEmail,
  PLANS,
} from "@mailforge/shared";
import { MessageRepository } from "../repositories/message-repository";
import { MailboxService } from "./mailbox-service";
import { OrganizationRepository } from "../repositories/organization-repository";
import { SendEmail, CreateDraft } from "@mailforge/validation";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

// Storage for tracking idempotency keys and daily email counts (in production, use DynamoDB or Redis)
const idempotencyMap = new Map<string, string>();
const dailyEmailCount = new Map<string, number>();

export class EmailService {
  private messageRepository: MessageRepository;
  private mailboxService: MailboxService;
  private organizationRepository: OrganizationRepository;

  constructor() {
    this.messageRepository = new MessageRepository();
    this.mailboxService = new MailboxService();
    this.organizationRepository = new OrganizationRepository();
  }

  async sendEmail(
    organizationId: string,
    input: SendEmail
  ): Promise<Message> {
    try {
      // Check idempotency
      if (input.idempotencyKey) {
        const existingMessageId = idempotencyMap.get(input.idempotencyKey);
        if (existingMessageId) {
          // Return cached result
          const message = await this.messageRepository.getByMessageId(
            existingMessageId
          );
          if (message) {
            return message;
          }
        }
      }

      // Validate sender is in organization
      const senderMailbox = await this.mailboxService.getMailboxByEmailAddress(
        organizationId,
        input.from
      );

      if (!senderMailbox) {
        throw new MailForgeError(
          ErrorCodes.INVALID_RECIPIENT,
          "Sender mailbox not found or not verified",
          400
        );
      }

      // Validate recipients
      const allRecipients = [
        ...input.to,
        ...(input.cc || []),
        ...(input.bcc || []),
      ];

      if (allRecipients.length === 0) {
        throw new MailForgeError(
          ErrorCodes.INVALID_INPUT,
          "At least one recipient is required",
          400
        );
      }

      for (const recipient of allRecipients) {
        if (!isValidEmail(recipient)) {
          throw new MailForgeError(
            ErrorCodes.INVALID_EMAIL,
            `Invalid recipient email: ${recipient}`,
            400
          );
        }
      }

      // Check organization quota
      await this.checkQuota(organizationId);

      // Create message record with pending status
      const messageId = generateId();
      const now = getCurrentTimestamp();
      const message: Message = {
        id: messageId,
        organizationId,
        mailboxId: senderMailbox.id,
        messageId: messageId, // Will be overwritten by SES MessageId
        direction: "outbound",
        status: "queued",
        from: input.from,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        textBody: input.textBody,
        htmlBody: input.htmlBody,
        attachments: [], // Will be populated from attachment IDs if provided
        isRead: false,
        isStarred: false,
        isArchived: false,
        isSpam: false,
        isTrashed: false,
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      };

      // Store message
      await this.messageRepository.create(message);

      // Track idempotency key
      if (input.idempotencyKey) {
        idempotencyMap.set(input.idempotencyKey, messageId);
      }

      // Enqueue to SQS for sending
      await this.enqueueForSending(message);

      // Increment daily email count
      this.incrementDailyEmailCount(organizationId);

      return message;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("SendEmail error:", error);
      throw new MailForgeError(
        ErrorCodes.EMAIL_SEND_FAILED,
        "Failed to send email",
        500
      );
    }
  }

  async createDraft(
    organizationId: string,
    input: CreateDraft
  ): Promise<Message> {
    try {
      // Validate mailbox exists and belongs to org
      const mailbox = await this.mailboxService.getMailbox(
        organizationId,
        input.mailboxId
      );

      if (!mailbox) {
        throw new MailForgeError(
          ErrorCodes.NOT_FOUND,
          "Mailbox not found",
          404
        );
      }

      // Validate from email if provided
      if (input.from) {
        const senderMailbox = await this.mailboxService.getMailboxByEmailAddress(
          organizationId,
          input.from
        );
        if (!senderMailbox) {
          throw new MailForgeError(
            ErrorCodes.INVALID_RECIPIENT,
            "Sender mailbox not found",
            400
          );
        }
      }

      // Validate recipients if provided
      if (input.to && input.to.length > 0) {
        for (const recipient of input.to) {
          if (!isValidEmail(recipient)) {
            throw new MailForgeError(
              ErrorCodes.INVALID_EMAIL,
              `Invalid recipient email: ${recipient}`,
              400
            );
          }
        }
      }

      const now = getCurrentTimestamp();
      const draft: Message = {
        id: generateId(),
        organizationId,
        mailboxId: input.mailboxId,
        messageId: "", // No SES message ID for drafts
        direction: "outbound",
        status: "draft",
        from: input.from || "",
        to: input.to || [],
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject || "",
        textBody: input.textBody,
        htmlBody: input.htmlBody,
        attachments: [],
        isRead: false,
        isStarred: false,
        isArchived: false,
        isSpam: false,
        isTrashed: false,
        createdAt: now,
        updatedAt: now,
      };

      await this.messageRepository.create(draft);
      return draft;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("CreateDraft error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to create draft",
        500
      );
    }
  }

  async updateDraft(
    organizationId: string,
    draftId: string,
    data: Partial<CreateDraft>
  ): Promise<Message> {
    try {
      // Get current draft
      const draft = await this.messageRepository.getByMessageId(draftId);

      if (!draft) {
        throw new MailForgeError(
          ErrorCodes.NOT_FOUND,
          "Draft not found",
          404
        );
      }

      if (draft.organizationId !== organizationId) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Access denied",
          403
        );
      }

      if (draft.status !== "draft") {
        throw new MailForgeError(
          ErrorCodes.CONFLICT,
          "Cannot update non-draft messages",
          409
        );
      }

      // Validate recipients if updating
      if (data.to && data.to.length > 0) {
        for (const recipient of data.to) {
          if (!isValidEmail(recipient)) {
            throw new MailForgeError(
              ErrorCodes.INVALID_EMAIL,
              `Invalid recipient email: ${recipient}`,
              400
            );
          }
        }
      }

      // Update the draft
      const updated = await this.messageRepository.update(
        { mailboxId: draft.mailboxId, createdAt: draft.createdAt },
        "SET #subject = :subject, #from = :from, #to = :to, #cc = :cc, #bcc = :bcc, textBody = :textBody, htmlBody = :htmlBody, updatedAt = :now",
        {
          "#subject": "subject",
          "#from": "from",
          "#to": "to",
          "#cc": "cc",
          "#bcc": "bcc",
        },
        {
          ":subject": data.subject ?? draft.subject,
          ":from": data.from ?? draft.from,
          ":to": data.to ?? draft.to,
          ":cc": data.cc ?? draft.cc,
          ":bcc": data.bcc ?? draft.bcc,
          ":textBody": data.textBody ?? draft.textBody,
          ":htmlBody": data.htmlBody ?? draft.htmlBody,
          ":now": getCurrentTimestamp(),
        }
      );

      return updated;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("UpdateDraft error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to update draft",
        500
      );
    }
  }

  async sendDraft(
    organizationId: string,
    draftId: string
  ): Promise<Message> {
    try {
      // Get draft
      const draft = await this.messageRepository.getByMessageId(draftId);

      if (!draft) {
        throw new MailForgeError(
          ErrorCodes.NOT_FOUND,
          "Draft not found",
          404
        );
      }

      if (draft.organizationId !== organizationId) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Access denied",
          403
        );
      }

      if (draft.status !== "draft") {
        throw new MailForgeError(
          ErrorCodes.CONFLICT,
          "Can only send draft messages",
          409
        );
      }

      // Validate required fields for sending
      if (!draft.from) {
        throw new MailForgeError(
          ErrorCodes.INVALID_INPUT,
          "Draft must have a from address",
          400
        );
      }

      if (!draft.to || draft.to.length === 0) {
        throw new MailForgeError(
          ErrorCodes.INVALID_INPUT,
          "Draft must have at least one recipient",
          400
        );
      }

      // Check quota
      await this.checkQuota(organizationId);

      // Update draft status to queued
      const now = getCurrentTimestamp();
      const message = await this.messageRepository.update(
        { mailboxId: draft.mailboxId, createdAt: draft.createdAt },
        "SET #status = :queued, sentAt = :now, updatedAt = :now",
        { "#status": "status" },
        {
          ":queued": "queued",
          ":now": now,
        }
      );

      // Enqueue to SQS for sending
      await this.enqueueForSending(message);

      // Increment daily email count
      this.incrementDailyEmailCount(organizationId);

      return message;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("SendDraft error:", error);
      throw new MailForgeError(
        ErrorCodes.EMAIL_SEND_FAILED,
        "Failed to send draft",
        500
      );
    }
  }

  async getDrafts(
    organizationId: string,
    mailboxId: string,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const result = await this.messageRepository.getMailboxMessages(
        mailboxId,
        limit
      );

      // Filter drafts only and verify organization
      return result.items.filter(
        (msg) => msg.status === "draft" && msg.organizationId === organizationId
      );
    } catch (error) {
      console.error("GetDrafts error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to retrieve drafts",
        500
      );
    }
  }

  async deleteDraft(
    organizationId: string,
    draftId: string
  ): Promise<void> {
    try {
      const draft = await this.messageRepository.getByMessageId(draftId);

      if (!draft) {
        throw new MailForgeError(
          ErrorCodes.NOT_FOUND,
          "Draft not found",
          404
        );
      }

      if (draft.organizationId !== organizationId) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Access denied",
          403
        );
      }

      if (draft.status !== "draft") {
        throw new MailForgeError(
          ErrorCodes.CONFLICT,
          "Can only delete draft messages",
          409
        );
      }

      await this.messageRepository.delete(draft.mailboxId, draft.createdAt);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("DeleteDraft error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to delete draft",
        500
      );
    }
  }

  private async checkQuota(organizationId: string): Promise<void> {
    // Get organization
    const org = await this.organizationRepository.get({
      id: organizationId,
    });

    if (!org) {
      throw new MailForgeError(
        ErrorCodes.NOT_FOUND,
        "Organization not found",
        404
      );
    }

    // Get plan limits
    const planConfig = PLANS[org.plan.toUpperCase() as keyof typeof PLANS];

    if (!planConfig) {
      throw new MailForgeError(
        ErrorCodes.INVALID_INPUT,
        "Invalid plan",
        400
      );
    }

    // Check daily email limit
    const emailCountKey = `${organizationId}-${new Date().toISOString().split("T")[0]}`;
    const emailCount = dailyEmailCount.get(emailCountKey) || 0;

    if (emailCount >= planConfig.emailsPerDay) {
      throw new MailForgeError(
        ErrorCodes.QUOTA_EXCEEDED,
        `Daily email limit (${planConfig.emailsPerDay}) exceeded`,
        429
      );
    }
  }

  private incrementDailyEmailCount(organizationId: string): void {
    const emailCountKey = `${organizationId}-${new Date().toISOString().split("T")[0]}`;
    const current = dailyEmailCount.get(emailCountKey) || 0;
    dailyEmailCount.set(emailCountKey, current + 1);

    // Clean up old entries (keep last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    for (const [key] of dailyEmailCount) {
      const [, date] = key.split("-");
      if (new Date(date) < sevenDaysAgo) {
        dailyEmailCount.delete(key);
      }
    }
  }

  private async enqueueForSending(message: Message): Promise<void> {
    const outboundQueueUrl = process.env.OUTBOUND_QUEUE_URL;

    if (!outboundQueueUrl) {
      throw new Error("OUTBOUND_QUEUE_URL not configured");
    }

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: outboundQueueUrl,
        MessageBody: JSON.stringify({
          type: "email.send",
          messageId: message.id,
          organizationId: message.organizationId,
          data: message,
        }),
        MessageGroupId: `${message.organizationId}-${message.mailboxId}`,
      })
    );
  }
}
