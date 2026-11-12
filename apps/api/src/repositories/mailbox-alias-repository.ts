import { MailboxAlias } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class MailboxAliasRepository extends BaseRepository<MailboxAlias> {
  constructor() {
    super(process.env.MAILBOX_ALIASES_TABLE || process.env.MAILBOXES_TABLE!);
  }

  async create(alias: MailboxAlias): Promise<void> {
    await super.create(alias);
  }

  async getById(id: string): Promise<MailboxAlias | null> {
    return super.get({ id });
  }

  async getByLocalPartAndDomain(
    localPart: string,
    domainId: string
  ): Promise<MailboxAlias | null> {
    // This would need a GSI in production
    const result = await super.scan(
      "localPart = :lp AND domainId = :domainId",
      { lp: localPart, domainId }
    );
    return result.items.length > 0 ? result.items[0] : null;
  }

  async getMailboxAliases(mailboxId: string): Promise<MailboxAlias[]> {
    // This would need a GSI in production
    const result = await super.scan(
      "mailboxId = :mailboxId",
      { mailboxId }
    );
    return result.items;
  }

  async delete(id: string): Promise<void> {
    await super.deleteItem({ id });
  }
}
