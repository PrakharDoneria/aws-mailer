import { Message } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

export class MessageRepository extends BaseRepository<Message> {
  constructor() {
    super(process.env.MESSAGES_TABLE!);
  }

  async create(message: Message): Promise<void> {
    await super.create(message);
  }

  async getById(id: string): Promise<Message | null> {
    // Requires knowing mailbox ID for partition key
    // In production, use messageId GSI
    return null;
  }

  async getByMessageId(messageId: string): Promise<Message | null> {
    const result = await super.query(
      "messageId = :msgId",
      { ":msgId": messageId },
      undefined,
      "message-id-index"
    );
    return result.items.length > 0 ? result.items[0] : null;
  }

  async getMailboxMessages(
    mailboxId: string,
    limit: number = 50,
    exclusiveStartKey?: Record<string, any>
  ): Promise<{ items: Message[]; lastKey?: Record<string, any> }> {
    const result = await super.query(
      "mailboxId = :mailboxId",
      { ":mailboxId": mailboxId },
      undefined,
      undefined,
      limit,
      exclusiveStartKey
    );
    return {
      items: result.items.sort((a, b) => b.createdAt - a.createdAt),
      lastKey: result.lastEvaluatedKey,
    };
  }

  async getOrganizationMessages(
    organizationId: string,
    limit: number = 50
  ): Promise<Message[]> {
    const result = await super.query(
      "organizationId = :orgId",
      { ":orgId": organizationId },
      undefined,
      "org-message-index",
      limit
    );
    return result.items;
  }

  async updateMessageStatus(
    id: string,
    mailboxId: string,
    status: string
  ): Promise<void> {
    // Update status in message
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { mailboxId, createdAt: Math.floor(Date.now() / 1000) },
        UpdateExpression: "SET #status = :status, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": status,
          ":now": Math.floor(Date.now() / 1000),
        },
      })
    );
  }

  async markAsRead(
    mailboxId: string,
    messageId: string
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { mailboxId, messageId },
        UpdateExpression: "SET isRead = :true",
        ExpressionAttributeValues: {
          ":true": true,
        },
      })
    );
  }

  async markAsUnread(
    mailboxId: string,
    messageId: string
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { mailboxId, messageId },
        UpdateExpression: "SET isRead = :false",
        ExpressionAttributeValues: {
          ":false": false,
        },
      })
    );
  }

  async delete(mailboxId: string, createdAt: number): Promise<void> {
    await super.deleteItem({ mailboxId, createdAt });
  }
}
