import { SQSEvent, Context } from "aws-lambda";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Message, getCurrentTimestamp } from "@mailforge/shared";
import * as nodemailer from "nodemailer";
import { simpleParser } from "mailparser";

const sesClient = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// Create nodemailer transporter with SES
const transporter = nodemailer.createTransport({
  SES: { ses: sesClient, aws: require("@aws-sdk/client-ses") },
});

const MAX_RETRIES = 3;

export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log("Outbound sender started", { messageCount: event.Records.length });

  const results = await Promise.allSettled(
    event.Records.map((record) => processMessage(record))
  );

  // Log summary
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log("Processing complete", { succeeded, failed, total: results.length });

  // If any failed, throw to trigger SQS retry
  if (failed > 0) {
    throw new Error(`${failed} messages failed to send`);
  }
};

async function processMessage(record: any): Promise<void> {
  try {
    const body = JSON.parse(record.body);
    const message: Message = body.data;

    if (!message || !message.from || !message.to) {
      console.error("Invalid message data", { messageId: message?.id });
      return; // Don't retry invalid messages
    }

    console.log("Processing message", {
      messageId: message.id,
      from: message.from,
      to: message.to,
      subject: message.subject,
    });

    // Validate sender domain is verified
    const domain = message.from.split("@")[1];
    if (!domain) {
      throw new Error("Invalid sender email format");
    }

    // Prepare recipients
    const recipients = [
      ...message.to,
      ...(message.cc || []),
      ...(message.bcc || []),
    ];

    // Send email via SES
    const response = await transporter.sendMail({
      from: message.from,
      to: message.to.join(", "),
      ...(message.cc && message.cc.length > 0 && { cc: message.cc.join(", ") }),
      ...(message.bcc && message.bcc.length > 0 && { bcc: message.bcc.join(", ") }),
      subject: message.subject,
      ...(message.textBody && { text: message.textBody }),
      ...(message.htmlBody && { html: message.htmlBody }),
      // Headers for tracking
      headers: {
        "X-MailForge-MessageId": message.id,
        "X-MailForge-OrganizationId": message.organizationId,
      },
    });

    if (!response.messageId) {
      throw new Error("No messageId returned from SES");
    }

    console.log("Email sent successfully", {
      messageId: message.id,
      sesMessageId: response.messageId,
    });

    // Update message status to sent
    await updateMessageStatus(
      message.mailboxId,
      message.createdAt,
      "sent",
      response.messageId
    );

  } catch (error) {
    console.error("Failed to send email", {
      error: error instanceof Error ? error.message : String(error),
      recordId: record.messageId,
    });

    // Check if message has retry attempts
    const body = JSON.parse(record.body);
    const retryCount = body.retryCount || 0;

    if (retryCount < MAX_RETRIES) {
      // For SQS, we rely on visibility timeout and DLQ
      // Re-throw to trigger retry
      throw error;
    } else {
      // Max retries exceeded, update message as failed
      const message: Message = body.data;
      try {
        await updateMessageStatus(
          message.mailboxId,
          message.createdAt,
          "failed",
          undefined
        );
      } catch (updateError) {
        console.error("Failed to update message status", updateError);
      }
    }
  }
}

async function updateMessageStatus(
  mailboxId: string,
  createdAt: number,
  status: string,
  sesMessageId?: string
): Promise<void> {
  const updateExpression = sesMessageId
    ? "SET #status = :status, messageId = :sesId, updatedAt = :now"
    : "SET #status = :status, updatedAt = :now";

  const expressionAttributeValues: Record<string, any> = {
    ":status": status,
    ":now": getCurrentTimestamp(),
  };

  if (sesMessageId) {
    expressionAttributeValues[":sesId"] = sesMessageId;
  }

  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.MESSAGES_TABLE,
        Key: marshall({
          mailboxId,
          createdAt,
        }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      })
    );

    console.log("Message status updated", { mailboxId, status });
  } catch (error) {
    console.error("Failed to update message status in DynamoDB", error);
    throw error;
  }
}
