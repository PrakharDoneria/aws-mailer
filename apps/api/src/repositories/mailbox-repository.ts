import { Mailbox, MailboxStatus } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class MailboxRepository extends BaseRepository<Mailbox> {
  constructor() {
    super(process.env.MAILBOXES_TABLE!);
  }

  async create(mailbox: Mailbox): Promise<void> {
    await super.create(mailbox);
  }

  async getById(id: string): Promise<Mailbox | null> {
    return super.get({ id });
  }

  async getOrganizationMailboxes(
    organizationId: string
  ): Promise<Mailbox[]> {
    const result = await super.query(
      "organizationId = :orgId",
      { orgId: organizationId },
      undefined,
      "org-mailbox-index"
    );
    return result.items;
  }

  async getMailboxByLocalPart(
    organizationId: string,
    localPart: string
  ): Promise<Mailbox | null> {
    const mailboxes = await this.getOrganizationMailboxes(organizationId);
    return (
      mailboxes.find(
        (m) =>
          m.localPart.toLowerCase() === localPart.toLowerCase() &&
          m.status !== "archived"
      ) || null
    );
  }

  async update(id: string, updates: Partial<Mailbox>): Promise<Mailbox> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      if (
        key === "id" ||
        key === "organizationId" ||
        key === "domainId" ||
        key === "localPart"
      )
        return; // Skip immutable fields
      const placeholder = `:val${index}`;
      updateExpressions.push(`#${key} = ${placeholder}`);
      expressionAttributeValues[placeholder] = value;
      expressionAttributeNames[`#${key}`] = key;
    });

    updateExpressions.push(`updatedAt = :now`);
    expressionAttributeValues[":now"] = Math.floor(Date.now() / 1000);

    return super.update(
      { id },
      `SET ${updateExpressions.join(", ")}`,
      expressionAttributeNames,
      expressionAttributeValues
    );
  }

  async updateStatus(id: string, status: MailboxStatus): Promise<Mailbox> {
    return this.update(id, { status } as Partial<Mailbox>);
  }

  async incrementUnreadCount(id: string): Promise<void> {
    await this.client.send(
      new (require("@aws-sdk/client-dynamodb").UpdateCommand)({
        TableName: this.tableName,
        Key: { id: { S: id } },
        UpdateExpression: "SET unreadCount = unreadCount + :inc",
        ExpressionAttributeValues: {
          ":inc": { N: "1" },
        },
      })
    );
  }

  async decrementUnreadCount(id: string): Promise<void> {
    await this.client.send(
      new (require("@aws-sdk/client-dynamodb").UpdateCommand)({
        TableName: this.tableName,
        Key: { id: { S: id } },
        UpdateExpression: "SET unreadCount = if_not_exists(unreadCount, :zero) - :dec",
        ExpressionAttributeValues: {
          ":zero": { N: "0" },
          ":dec": { N: "1" },
        },
      })
    );
  }

  async updateStorageUsed(
    id: string,
    incrementBy: number
  ): Promise<void> {
    await this.client.send(
      new (require("@aws-sdk/client-dynamodb").UpdateCommand)({
        TableName: this.tableName,
        Key: { id: { S: id } },
        UpdateExpression: "SET storageUsed = storageUsed + :inc",
        ExpressionAttributeValues: {
          ":inc": { N: incrementBy.toString() },
        },
      })
    );
  }

  async delete(id: string): Promise<void> {
    await super.delete({ id });
  }
}
