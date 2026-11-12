import { Message } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

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
      { msgId: messageId },
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
      { mailboxId },
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
      { orgId: organizationId },
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
      new (require("@aws-sdk/client-dynamodb").UpdateCommand)({
        TableName: this.tableName,
        Key: {
          mailboxId: { S: mailboxId },
          createdAt: { N: Math.floor(Date.now() / 1000).toString() },
        },
        UpdateExpression: "SET #status = :status, updatedAt = :now",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": { S: status },
          ":now": { N: Math.floor(Date.now() / 1000).toString() },
        },
      })
    );
  }

  async markAsRead(
    mailboxId: string,
    messageId: string
  ): Promise<void> {
    await this.client.send(
      new (require("@aws-sdk/client-dynamodb").UpdateCommand)({
        TableName: this.tableName,
        Key: {
          mailboxId: { S: mailboxId },
          messageId: { S: messageId },
        },
        UpdateExpression: "SET isRead = :true",
        ExpressionAttributeValues: {
          ":true": { BOOL: true },
        },
      })
    );
  }

  async markAsUnread(
    mailboxId: string,
    messageId: string
  ): Promise<void> {
    await this.client.send(
      new (require("@aws-sdk/client-dynamodb").UpdateCommand)({
        TableName: this.tableName,
        Key: {
          mailboxId: { S: mailboxId },
          messageId: { S: messageId },
        },
        UpdateExpression: "SET isRead = :false",
        ExpressionAttributeValues: {
          ":false": { BOOL: false },
        },
      })
    );
  }

  async delete(mailboxId: string, createdAt: number): Promise<void> {
    await super.delete({ mailboxId, createdAt });
  }
}
