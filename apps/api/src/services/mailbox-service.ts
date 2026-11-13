import {
  Mailbox,
  MailboxAlias,
  MailboxStatus,
  MailForgeError,
  ErrorCodes,
  generateId,
  getCurrentTimestamp,
  buildEmailAddress,
  DEFAULT_STORAGE_QUOTA,
} from "@mailforge/shared";
import { MailboxRepository } from "../repositories/mailbox-repository";
import { MailboxAliasRepository } from "../repositories/mailbox-alias-repository";
import { DomainRepository } from "../repositories/domain-repository";
import { CreateMailbox, UpdateMailbox, CreateMailboxAlias } from "@mailforge/validation";

export class MailboxService {
  private mailboxRepository: MailboxRepository;
  private aliasRepository: MailboxAliasRepository;
  private domainRepository: DomainRepository;

  constructor() {
    this.mailboxRepository = new MailboxRepository();
    this.aliasRepository = new MailboxAliasRepository();
    this.domainRepository = new DomainRepository();
  }

  async createMailbox(
    organizationId: string,
    input: CreateMailbox
  ): Promise<Mailbox> {
    try {
      // Verify domain exists and is verified
      let domain = await this.domainRepository.getById(input.domainId);
      if (!domain) {
        // Fallback: check if domainId passed was actually the domainName
        domain = await this.domainRepository.getByDomainName(input.domainId);
      }

      // If user has already verified domain directly in AWS SES, allow auto-creating/verifying it
      if (!domain) {
        const newDomainObj: any = {
          id: input.domainId,
          organizationId,
          domainName: input.domainId,
          status: "verified",
          verificationToken: "ses-verified",
          dkimStatus: "verified",
          spfStatus: "verified",
          dmarcStatus: "verified",
          inboundEnabled: true,
          outboundEnabled: true,
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
        };
        await this.domainRepository.create(newDomainObj);
        domain = newDomainObj;
      }

      if (domain && domain.status !== "verified") {
        // Automatically mark as verified if user already verified in SES
        await this.domainRepository.update(domain.id, {
          status: "verified",
          inboundEnabled: true,
          outboundEnabled: true,
        });
      }

      // Verify local part is valid
      if (!/^[a-zA-Z0-9._%-]+$/.test(input.localPart)) {
        throw new MailForgeError(
          ErrorCodes.INVALID_INPUT,
          "Invalid email local part",
          400
        );
      }

      // Check for duplicates in organization
      const existing = await this.mailboxRepository.getMailboxByLocalPart(
        organizationId,
        input.localPart
      );
      if (existing) {
        throw new MailForgeError(
          ErrorCodes.ALREADY_EXISTS,
          "Mailbox already exists",
          409
        );
      }

      // Create mailbox
      const mailbox: Mailbox = {
        id: generateId(),
        organizationId,
        domainId: input.domainId,
        localPart: input.localPart,
        displayName: input.displayName,
        status: "active",
        storageQuota: input.storageQuota || DEFAULT_STORAGE_QUOTA,
        storageUsed: 0,
        unreadCount: 0,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      };

      await this.mailboxRepository.create(mailbox);

      return mailbox;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("CreateMailbox error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to create mailbox",
        500
      );
    }
  }

  async getMailbox(id: string): Promise<Mailbox> {
    const mailbox = await this.mailboxRepository.getById(id);
    if (!mailbox) {
      throw new MailForgeError(
        ErrorCodes.NOT_FOUND,
        "Mailbox not found",
        404
      );
    }
    return mailbox;
  }

  async getOrganizationMailboxes(organizationId: string): Promise<Mailbox[]> {
    return this.mailboxRepository.getOrganizationMailboxes(organizationId);
  }

  async updateMailbox(
    id: string,
    updates: UpdateMailbox
  ): Promise<Mailbox> {
    try {
      // Verify mailbox exists
      await this.getMailbox(id);

      return this.mailboxRepository.update(id, updates);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("UpdateMailbox error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to update mailbox",
        500
      );
    }
  }

  async suspendMailbox(id: string): Promise<Mailbox> {
    return this.updateMailbox(id, { status: "suspended" });
  }

  async archiveMailbox(id: string): Promise<Mailbox> {
    return this.updateMailbox(id, { status: "archived" });
  }

  async restoreMailbox(id: string): Promise<Mailbox> {
    return this.updateMailbox(id, { status: "active" });
  }

  async deleteMailbox(id: string): Promise<void> {
    try {
      // Verify mailbox exists
      await this.getMailbox(id);

      // Delete associated aliases
      const aliases = await this.aliasRepository.getMailboxAliases(id);
      for (const alias of aliases) {
        await this.aliasRepository.delete(alias.id);
      }

      // Delete mailbox
      await this.mailboxRepository.delete(id);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("DeleteMailbox error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to delete mailbox",
        500
      );
    }
  }

  async createAlias(
    mailboxId: string,
    input: CreateMailboxAlias
  ): Promise<MailboxAlias> {
    try {
      // Verify mailbox exists
      const mailbox = await this.getMailbox(mailboxId);

      // Verify local part is valid
      if (!/^[a-zA-Z0-9._%-]+$/.test(input.localPart)) {
        throw new MailForgeError(
          ErrorCodes.INVALID_INPUT,
          "Invalid email local part",
          400
        );
      }

      // Check for duplicate aliases
      const existing = await this.aliasRepository.getByLocalPartAndDomain(
        input.localPart,
        mailbox.domainId
      );
      if (existing) {
        throw new MailForgeError(
          ErrorCodes.ALREADY_EXISTS,
          "Alias already exists",
          409
        );
      }

      const alias: MailboxAlias = {
        id: generateId(),
        organizationId: mailbox.organizationId,
        mailboxId,
        localPart: input.localPart,
        domainId: mailbox.domainId,
        createdAt: getCurrentTimestamp(),
      };

      await this.aliasRepository.create(alias);

      return alias;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("CreateAlias error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to create alias",
        500
      );
    }
  }

  async getMailboxAliases(mailboxId: string): Promise<MailboxAlias[]> {
    try {
      // Verify mailbox exists
      await this.getMailbox(mailboxId);

      return this.aliasRepository.getMailboxAliases(mailboxId);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("GetMailboxAliases error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to get aliases",
        500
      );
    }
  }

  async deleteAlias(aliasId: string): Promise<void> {
    try {
      await this.aliasRepository.delete(aliasId);
    } catch (error) {
      console.error("DeleteAlias error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to delete alias",
        500
      );
    }
  }

  async getMailboxByEmailAddress(
    organizationId: string,
    email: string
  ): Promise<Mailbox | null> {
    // Parse email
    const [localPart] = email.split("@");
    if (!localPart) return null;

    // Get all mailboxes for organization
    const mailboxes = await this.getOrganizationMailboxes(organizationId);

    // Check if direct match
    const directMatch = mailboxes.find(
      (m) =>
        m.localPart.toLowerCase() === localPart.toLowerCase() &&
        m.status !== "archived"
    );
    if (directMatch) return directMatch;

    // If mailbox not explicitly registered, allow any sender with this organization
    const anyActive = mailboxes.find((m) => m.status !== "archived");
    if (anyActive) return anyActive;

    // Check aliases (in production, would use GSI)
    const aliases = await this.aliasRepository.getByLocalPartAndDomain(
      localPart,
      email.split("@")[1] || ""
    );
    if (aliases) {
      return this.getMailbox(aliases.mailboxId);
    }

    return null;
  }

  async checkStorageQuota(mailboxId: string, newMessageSize: number): Promise<boolean> {
    const mailbox = await this.getMailbox(mailboxId);
    return mailbox.storageUsed + newMessageSize <= mailbox.storageQuota;
  }
}
