import { SQSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

interface WebhookEvent {
  organizationId: string;
  type: string;
  timestamp: number;
  details: Record<string, unknown>;
}

interface Webhook {
  id: string;
  url: string;
  secret?: string;
  enabled?: boolean;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const results = await Promise.allSettled(
    event.Records.map((record) => dispatchWebhook(JSON.parse(record.body) as WebhookEvent))
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    throw new Error(`${failed.length} webhook events failed to dispatch`);
  }
};

async function dispatchWebhook(webhookEvent: WebhookEvent): Promise<void> {
  const webhooks = await findWebhooks(webhookEvent.organizationId);

  await Promise.all(
    webhooks
      .filter((webhook) => webhook.enabled !== false)
      .map(async (webhook) => {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookEvent),
        });
        if (!response.ok) {
          throw new Error(`Webhook ${webhook.id} returned HTTP ${response.status}`);
        }
      })
  );
}

async function findWebhooks(organizationId: string): Promise<Webhook[]> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: process.env.WEBHOOKS_TABLE,
      IndexName: "org-webhook-index",
      KeyConditionExpression: "organizationId = :organizationId",
      ExpressionAttributeValues: marshall({
        ":organizationId": organizationId,
      }),
    })
  );
  return (result.Items ?? []).map((item) => unmarshall(item) as Webhook);
}
