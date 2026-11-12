import { SQSEvent, Context } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { marshall } from "@aws-sdk/util-dynamodb";
import { parseMimeEmail } from "@mailforge/email-parser";
import { generateId, getCurrentTimestamp } from "@mailforge/shared";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

interface SESMessage {
  mail: {
    source: string;
    destination: string[];
    timestamp: string;
    messageId: string;
  };
  receipt: {
    recipients: string[];
    timestamp: string;
    processingTimeMillis: number;
  };
}

export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log("Inbound processor started", { messageCount: event.Records.length });

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const sesMessage: SESMessage = JSON.parse(body.Message || record.body);

      console.log("Processing email", {
        from: sesMessage.mail.source,
        to: sesMessage.mail.destination,
        messageId: sesMessage.mail.messageId,
      });

      // Get raw email from S3
      const s3Key = `${sesMessage.mail.messageId}/message`;
      const emailContent = await getEmailFromS3(s3Key);

      // Parse MIME
      const parsed = await parseMimeEmail(emailContent);

      // Process each recipient
      for (const recipient of sesMessage.receipt.recipients) {
        await processRecipient(recipient, parsed, sesMessage);
      }

      // Delete message from SQS
      await sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: process.env.INBOUND_QUEUE_URL,
          ReceiptHandle: record.receiptHandle,
        })
      );

      console.log("Email processed successfully", {
        messageId: sesMessage.mail.messageId,
      });
    } catch (error) {
      console.error("Failed to process email", error);
      // Message will be sent to DLQ after max retries
    }
  }
};

async function getEmailFromS3(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: process.env.EMAIL_BUCKET,
      Key: key,
    })
  );

  const chunks: Buffer[] = [];
  const stream = response.Body as NodeJS.ReadableStream;

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function processRecipient(
  recipient: string,
  parsed: any,
  sesMessage: SESMessage
): Promise<void> {
  // Parse recipient domain
  const [localPart, domain] = recipient.split("@");

  // TODO: Query mailbox routing
  // Get mailbox for recipient email address
  // For now, placeholder implementation

  const mailboxId = generateId(); // Placeholder
  const organizationId = generateId(); // Placeholder

  // Store raw email in S3
  const rawEmailKey = `emails/${organizationId}/${mailboxId}/${sesMessage.mail.messageId}/message.eml`;
  const emailContent = await getEmailFromS3(
    `${sesMessage.mail.messageId}/message`
  );

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.EMAIL_BUCKET,
      Key: rawEmailKey,
      Body: emailContent,
      ContentType: "message/rfc822",
      ServerSideEncryption: "aws:kms",
    })
  );

  // Store attachment metadata in S3
  const attachmentMetadata = parsed.attachments.map((att: any) => ({
    id: att.id,
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size,
    s3Key: `attachments/${organizationId}/${mailboxId}/${att.id}`,
  }));

  // Create message record in DynamoDB
  const message = {
    id: generateId(),
    organizationId,
    mailboxId,
    messageId: sesMessage.mail.messageId,
    direction: "inbound",
    status: "delivered",
    from: parsed.from,
    to: Array.isArray(parsed.to) ? parsed.to : [parsed.to],
    cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : undefined,
    subject: parsed.subject,
    textBody: parsed.textBody?.substring(0, 100000),
    htmlBody: parsed.htmlBody?.substring(0, 500000),
    rawEmailS3Key: rawEmailKey,
    attachments: attachmentMetadata,
    isRead: false,
    isStarred: false,
    isArchived: false,
    isSpam: false,
    isTrashed: false,
    receivedAt: Math.floor(new Date(sesMessage.mail.timestamp).getTime() / 1000),
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp(),
  };

  await dynamoClient.send(
    new PutItemCommand({
      TableName: process.env.MESSAGES_TABLE,
      Item: marshall(message),
    })
  );

  // Update mailbox unread count
  await dynamoClient.send(
    new UpdateItemCommand({
      TableName: process.env.MAILBOXES_TABLE,
      Key: marshall({ id: mailboxId }),
      UpdateExpression: "SET unreadCount = unreadCount + :inc",
      ExpressionAttributeValues: marshall({
        ":inc": 1,
      }),
    })
  );

  // TODO: Publish webhook event for email.received
  // TODO: Send notification to connected users
}
