import { SQSEvent, Context } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
    action?: {
      type: string;
      bucketName?: string;
      objectKey?: string;
      objectKeyPrefix?: string;
    };
  };
  content?: string;
}

export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log("Inbound processor started", { messageCount: event.Records.length });

  for (const record of event.Records) {
    try {
      let body: any;
      try {
        body = JSON.parse(record.body);
      } catch {
        body = record.body;
      }

      let sesMessage: SESMessage;
      if (body && typeof body === "object" && body.Message) {
        sesMessage = JSON.parse(body.Message);
      } else {
        sesMessage = body;
      }

      if (!sesMessage || !sesMessage.mail) {
        console.warn("Skipping record: not a valid SES notification", { body });
        await deleteSQSMessage(record.receiptHandle);
        continue;
      }

      console.log("Processing email", {
        from: sesMessage.mail.source,
        to: sesMessage.mail.destination,
        messageId: sesMessage.mail.messageId,
      });

      // Retrieve raw email: check receipt action, default S3 keys, or fallback to body content
      let emailContent: Buffer | null = null;
      const bucketName = sesMessage.receipt?.action?.bucketName || process.env.EMAIL_BUCKET!;
      const candidateKeys = [
        sesMessage.receipt?.action?.objectKey,
        sesMessage.receipt?.action?.objectKeyPrefix
          ? `${sesMessage.receipt.action.objectKeyPrefix}${sesMessage.mail.messageId}`
          : null,
        `inbound/${sesMessage.mail.messageId}`,
        `${sesMessage.mail.messageId}/message`,
        sesMessage.mail.messageId,
      ].filter(Boolean) as string[];

      for (const k of candidateKeys) {
        try {
          emailContent = await getEmailFromS3(bucketName, k);
          if (emailContent) {
            console.log("Retrieved email content using S3 key:", k);
            break;
          }
        } catch (s3Err) {
          // try next key
        }
      }

      if (!emailContent && sesMessage.content) {
        emailContent = Buffer.from(sesMessage.content, "utf-8");
      }

      if (!emailContent) {
        console.error("Could not locate email body in S3 or SNS payload", {
          messageId: sesMessage.mail.messageId,
          triedKeys: candidateKeys,
        });
        await deleteSQSMessage(record.receiptHandle);
        continue;
      }

      // Parse MIME email
      const parsed = await parseMimeEmail(emailContent);

      // Recipients from SES receipt or mail.destination
      const recipients =
        sesMessage.receipt?.recipients || sesMessage.mail.destination || [];

      for (const recipient of recipients) {
        await processRecipient(recipient, parsed, sesMessage, emailContent);
      }

      await deleteSQSMessage(record.receiptHandle);
      console.log("Email processed successfully", {
        messageId: sesMessage.mail.messageId,
      });
    } catch (error) {
      console.error("Failed to process email record", error);
    }
  }
};

async function deleteSQSMessage(receiptHandle: string): Promise<void> {
  if (!process.env.INBOUND_QUEUE_URL) return;
  try {
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: process.env.INBOUND_QUEUE_URL,
        ReceiptHandle: receiptHandle,
      })
    );
  } catch (err) {
    console.error("Failed to delete message from SQS", err);
  }
}

async function getEmailFromS3(bucket: string, key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
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

async function findMailbox(localPart: string, domainName: string): Promise<{ mailboxId: string; organizationId: string } | null> {
  try {
    // 1. Scan mailboxes table for matching localPart and domain
    const scanRes = await dynamoClient.send(
      new ScanCommand({
        TableName: process.env.MAILBOXES_TABLE,
        FilterExpression: "localPart = :lp",
        ExpressionAttributeValues: marshall({ ":lp": localPart.toLowerCase() }),
      })
    );

    if (scanRes.Items && scanRes.Items.length > 0) {
      for (const item of scanRes.Items) {
        const mb = unmarshall(item);
        if (
          mb.domainId?.toLowerCase() === domainName.toLowerCase() ||
          mb.domainName?.toLowerCase() === domainName.toLowerCase() ||
          !mb.domainId
        ) {
          return { mailboxId: mb.id, organizationId: mb.organizationId };
        }
      }
      const first = unmarshall(scanRes.Items[0]);
      return { mailboxId: first.id, organizationId: first.organizationId };
    }

    // 2. Fallback: query domain by name to find organization
    const domainRes = await dynamoClient.send(
      new QueryCommand({
        TableName: process.env.DOMAINS_TABLE,
        IndexName: "domain-name-index",
        KeyConditionExpression: "domainName = :dn",
        ExpressionAttributeValues: marshall({ ":dn": domainName.toLowerCase() }),
      })
    );

    if (domainRes.Items && domainRes.Items.length > 0) {
      const d = unmarshall(domainRes.Items[0]);
      // Auto-create mailbox for this localPart
      const newMailboxId = generateId();
      await dynamoClient.send(
        new PutItemCommand({
          TableName: process.env.MAILBOXES_TABLE,
          Item: marshall({
            id: newMailboxId,
            organizationId: d.organizationId,
            domainId: domainName,
            localPart: localPart.toLowerCase(),
            displayName: localPart,
            status: "active",
            storageQuota: 5368709120,
            storageUsed: 0,
            unreadCount: 0,
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
          }),
        })
      );
      return { mailboxId: newMailboxId, organizationId: d.organizationId };
    }
  } catch (err) {
    console.error("Error finding mailbox:", err);
  }

  return null;
}

async function processRecipient(
  recipient: string,
  parsed: any,
  sesMessage: SESMessage,
  emailContent: Buffer
): Promise<void> {
  const parts = recipient.split("@");
  if (parts.length < 2) return;
  const localPart = parts[0].toLowerCase();
  const domainName = parts[1].toLowerCase();

  const found = await findMailbox(localPart, domainName);
  const mailboxId = found ? found.mailboxId : generateId();
  const organizationId = found ? found.organizationId : "inbound-org";

  const rawEmailKey = `emails/${organizationId}/${mailboxId}/${sesMessage.mail.messageId}/message.eml`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.EMAIL_BUCKET,
        Key: rawEmailKey,
        Body: emailContent,
        ContentType: "message/rfc822",
      })
    );
  } catch (s3Err) {
    console.warn("Could not archive raw email to S3:", s3Err);
  }

  const attachmentMetadata = (parsed.attachments || []).map((att: any) => ({
    id: att.id || generateId(),
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size,
    s3Key: `attachments/${organizationId}/${mailboxId}/${att.id || generateId()}`,
  }));

  const now = getCurrentTimestamp();
  const message = {
    id: generateId(),
    organizationId,
    mailboxId,
    messageId: sesMessage.mail.messageId,
    direction: "inbound",
    status: "delivered",
    from: parsed.from?.text || parsed.from || sesMessage.mail.source,
    to: Array.isArray(parsed.to) ? parsed.to : [parsed.to || recipient],
    cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : undefined,
    subject: parsed.subject || "(No Subject)",
    textBody: parsed.textBody || parsed.text || "",
    htmlBody: parsed.htmlBody || parsed.html || "",
    rawEmailS3Key: rawEmailKey,
    attachments: attachmentMetadata,
    isRead: false,
    isStarred: false,
    isArchived: false,
    isSpam: false,
    isTrashed: false,
    receivedAt: Math.floor(new Date(sesMessage.mail.timestamp).getTime() / 1000) || now,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoClient.send(
    new PutItemCommand({
      TableName: process.env.MESSAGES_TABLE,
      Item: marshall(message),
    })
  );

  // Update mailbox unread count
  if (found) {
    try {
      await dynamoClient.send(
        new UpdateItemCommand({
          TableName: process.env.MAILBOXES_TABLE,
          Key: marshall({ id: mailboxId }),
          UpdateExpression: "SET unreadCount = unreadCount + :inc",
          ExpressionAttributeValues: marshall({ ":inc": 1 }),
        })
      );
    } catch (e) {
      console.warn("Could not increment unreadCount", e);
    }
  }
}
