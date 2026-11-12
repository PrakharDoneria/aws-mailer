import { SNSEvent, Context } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getCurrentTimestamp, MessageEvent } from "@mailforge/shared";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

interface SESEvent {
  bounce?: {
    bounceType: "Permanent" | "Temporary" | "Undetermined";
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      status: string;
      diagnosticCode: string;
    }>;
    timestamp: string;
    remoteMtaIp?: string;
    feedbackId: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    timestamp: string;
    complaintFeedbackType?: string;
    userAgent?: string;
  };
  delivery?: {
    recipients: string[];
    timestamp: string;
    processingTimeMillis: number;
    remoteMtaIp?: string;
    smtpResponse: string;
  };
  send?: {
    timestamp: string;
  };
  reject?: {
    timestamp: string;
    reason: string;
    rejectedRecipients: Array<{
      emailAddress: string;
      status: string;
      diagnosticCode: string;
    }>;
  };
  mail: {
    timestamp: string;
    source: string;
    sourceArn: string;
    messageId: string;
    headers: Array<{
      name: string;
      value: string;
    }>;
    commonHeaders: Record<string, string | string[]>;
  };
}

export const handler = async (event: SNSEvent, context: Context): Promise<void> => {
  console.log("SES event processor started", { records: event.Records.length });

  const results = await Promise.allSettled(
    event.Records.map((record) => processSESEvent(record))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log("SES event processing complete", { succeeded, failed });

  if (failed > 0) {
    throw new Error(`${failed} SES events failed to process`);
  }
};

async function processSESEvent(record: any): Promise<void> {
  try {
    const message = JSON.parse(record.Sns.Message) as {
      eventType: string;
      bounce?: SESEvent["bounce"];
      complaint?: SESEvent["complaint"];
      delivery?: SESEvent["delivery"];
      send?: SESEvent["send"];
      reject?: SESEvent["reject"];
      mail: SESEvent["mail"];
    };

    const eventType = message.eventType;
    console.log("Processing SES event", { eventType, messageId: message.mail.messageId });

    // Extract MailForge message ID from headers
    const mailForgeMessageId = message.mail.headers.find(
      (h) => h.name === "X-MailForge-MessageId"
    )?.value;

    const organizationId = message.mail.headers.find(
      (h) => h.name === "X-MailForge-OrganizationId"
    )?.value;

    if (!mailForgeMessageId || !organizationId) {
      console.warn("Missing MailForge headers", { messageId: message.mail.messageId });
      return;
    }

    // Find mailbox ID by message ID
    const mailboxId = await findMailboxIdByMessageId(mailForgeMessageId);

    if (!mailboxId) {
      console.warn("Mailbox not found for message", { messageId: mailForgeMessageId });
      return;
    }

    // Process based on event type
    switch (eventType) {
      case "Bounce":
        await processBounce(message, mailForgeMessageId, mailboxId, organizationId);
        break;
      case "Complaint":
        await processComplaint(message, mailForgeMessageId, mailboxId, organizationId);
        break;
      case "Delivery":
        await processDelivery(message, mailForgeMessageId, mailboxId, organizationId);
        break;
      case "Send":
        await processSend(message, mailForgeMessageId, mailboxId, organizationId);
        break;
      case "Reject":
        await processReject(message, mailForgeMessageId, mailboxId, organizationId);
        break;
      default:
        console.warn("Unknown SES event type", { eventType });
    }
  } catch (error) {
    console.error("Error processing SES event", error);
    throw error;
  }
}

async function findMailboxIdByMessageId(messageId: string): Promise<string | null> {
  try {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: process.env.MESSAGES_TABLE,
        IndexName: "message-id-index",
        KeyConditionExpression: "messageId = :msgId",
        ExpressionAttributeValues: marshall({
          ":msgId": messageId,
        }),
        Limit: 1,
      })
    );

    if (result.Items && result.Items.length > 0) {
      const message = unmarshall(result.Items[0]) as any;
      return message.mailboxId;
    }

    return null;
  } catch (error) {
    console.error("Error finding mailbox ID", error);
    return null;
  }
}

async function processBounce(
  message: any,
  messageId: string,
  mailboxId: string,
  organizationId: string
): Promise<void> {
  const bounceType = message.bounce.bounceType;
  const status = bounceType === "Permanent" ? "bounced" : "failed";

  console.log("Processing bounce", { messageId, bounceType, status });

  await updateMessageStatus(mailboxId, messageId, status);

  // Publish webhook event
  await publishWebhookEvent({
    type: "bounce",
    messageId,
    organizationId,
    timestamp: Date.now(),
    details: {
      bounceType: message.bounce.bounceType,
      bounceSubType: message.bounce.bounceSubType,
      recipients: message.bounce.bouncedRecipients.map((r: any) => r.emailAddress),
    },
  });
}

async function processComplaint(
  message: any,
  messageId: string,
  mailboxId: string,
  organizationId: string
): Promise<void> {
  console.log("Processing complaint", { messageId });

  await updateMessageStatus(mailboxId, messageId, "complained");

  // Publish webhook event
  await publishWebhookEvent({
    type: "complaint",
    messageId,
    organizationId,
    timestamp: Date.now(),
    details: {
      recipients: message.complaint.complainedRecipients.map((r: any) => r.emailAddress),
      feedbackType: message.complaint.complaintFeedbackType,
    },
  });
}

async function processDelivery(
  message: any,
  messageId: string,
  mailboxId: string,
  organizationId: string
): Promise<void> {
  console.log("Processing delivery", { messageId });

  await updateMessageStatus(mailboxId, messageId, "delivered");

  // Publish webhook event
  await publishWebhookEvent({
    type: "delivery",
    messageId,
    organizationId,
    timestamp: Date.now(),
    details: {
      recipients: message.delivery.recipients,
      processingTimeMs: message.delivery.processingTimeMillis,
      smtpResponse: message.delivery.smtpResponse,
    },
  });
}

async function processSend(
  message: any,
  messageId: string,
  mailboxId: string,
  organizationId: string
): Promise<void> {
  console.log("Processing send", { messageId });

  // Send event is informational - message is already "sent" status
  await publishWebhookEvent({
    type: "send",
    messageId,
    organizationId,
    timestamp: Date.now(),
    details: {
      source: message.mail.source,
    },
  });
}

async function processReject(
  message: any,
  messageId: string,
  mailboxId: string,
  organizationId: string
): Promise<void> {
  console.log("Processing reject", { messageId });

  await updateMessageStatus(mailboxId, messageId, "rejected");

  // Publish webhook event
  await publishWebhookEvent({
    type: "reject",
    messageId,
    organizationId,
    timestamp: Date.now(),
    details: {
      reason: message.reject.reason,
      recipients: message.reject.rejectedRecipients.map((r: any) => r.emailAddress),
    },
  });
}

async function updateMessageStatus(
  mailboxId: string,
  messageId: string,
  status: string
): Promise<void> {
  try {
    // Query to get the message first (to find createdAt)
    const queryResult = await dynamoClient.send(
      new QueryCommand({
        TableName: process.env.MESSAGES_TABLE,
        KeyConditionExpression: "mailboxId = :mailboxId",
        FilterExpression: "id = :id OR messageId = :id",
        ExpressionAttributeValues: marshall({
          ":mailboxId": mailboxId,
          ":id": messageId,
        }),
        Limit: 1,
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      console.warn("Message not found", { messageId, mailboxId });
      return;
    }

    const message = unmarshall(queryResult.Items[0]) as any;

    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.MESSAGES_TABLE,
        Key: marshall({
          mailboxId,
          createdAt: message.createdAt,
        }),
        UpdateExpression: "SET #status = :status, updatedAt = :now",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: marshall({
          ":status": status,
          ":now": getCurrentTimestamp(),
        }),
      })
    );

    console.log("Message status updated", { messageId, status });
  } catch (error) {
    console.error("Failed to update message status", error);
    throw error;
  }
}

async function publishWebhookEvent(event: MessageEvent): Promise<void> {
  try {
    const webhookQueueUrl = process.env.WEBHOOK_QUEUE_URL;

    if (!webhookQueueUrl) {
      console.warn("WEBHOOK_QUEUE_URL not configured");
      return;
    }

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: webhookQueueUrl,
        MessageBody: JSON.stringify({
          type: "webhook.event",
          event,
        }),
        MessageGroupId: `${event.organizationId}-events`,
      })
    );

    console.log("Webhook event published", { eventType: event.type, messageId: event.messageId });
  } catch (error) {
    console.error("Failed to publish webhook event", error);
    // Don't throw - webhook publishing is non-critical
  }
}
