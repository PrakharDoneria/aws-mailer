import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export class BaseRepository<T> {
  protected client: DynamoDBDocumentClient;
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.AWS_REGION })
    );
  }

  async create(item: T): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: item as Record<string, unknown>,
    });
    await this.client.send(command);
  }

  async get(key: Record<string, any>): Promise<T | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: key,
    });
    const response = await this.client.send(command);
    return response.Item ? (response.Item as T) : null;
  }

  /**
   * Normalizes expression attribute values so every key starts with a colon ':'
   * (e.g. converts { email: "a@b.com" } to { ":email": "a@b.com" }).
   * DynamoDB requires all ExpressionAttributeValues keys to begin with ':'.
   */
  protected normalizeExpressionValues(
    values?: Record<string, any>
  ): Record<string, any> | undefined {
    if (!values) return undefined;
    const normalized: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      const formattedKey = key.startsWith(":") ? key : `:${key}`;
      normalized[formattedKey] = val;
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  protected async updateItem(
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>
  ): Promise<T> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: this.normalizeExpressionValues(
        expressionAttributeValues
      ),
      ReturnValues: "ALL_NEW",
    });
    const response = await this.client.send(command);
    return response.Attributes as T;
  }

  async updateRecord(
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>
  ): Promise<T> {
    return this.updateItem(
      key,
      updateExpression,
      expressionAttributeNames,
      expressionAttributeValues
    );
  }

  protected async deleteItem(key: Record<string, any>): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: key,
    });
    await this.client.send(command);
  }

  async query(
    keyConditionExpression: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    indexName?: string,
    limit?: number,
    exclusiveStartKey?: Record<string, any>
  ): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: this.normalizeExpressionValues(
        expressionAttributeValues
      ),
      ExpressionAttributeNames: expressionAttributeNames,
      IndexName: indexName,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey
        ? exclusiveStartKey
        : undefined,
    });
    const response = await this.client.send(command);
    return {
      items: (response.Items || []) as T[],
      lastEvaluatedKey: response.LastEvaluatedKey
        ? response.LastEvaluatedKey
        : undefined,
    };
  }

  async scan(
    filterExpression?: string,
    expressionAttributeValues?: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    limit?: number
  ): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, any> }> {
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: this.normalizeExpressionValues(
        expressionAttributeValues
      ),
      ExpressionAttributeNames: expressionAttributeNames,
      Limit: limit,
    });
    const response = await this.client.send(command);
    return {
      items: (response.Items || []) as T[],
      lastEvaluatedKey: response.LastEvaluatedKey
        ? response.LastEvaluatedKey
        : undefined,
    };
  }

  protected getTableName(): string {
    return this.tableName;
  }
}
