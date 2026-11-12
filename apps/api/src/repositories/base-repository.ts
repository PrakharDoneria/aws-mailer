import {
  DynamoDBClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export class BaseRepository<T> {
  protected client: DynamoDBClient;
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.client = new DynamoDBClient({ region: process.env.AWS_REGION });
  }

  async create(item: T): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: marshall(item),
    });
    await this.client.send(command);
  }

  async get(key: Record<string, any>): Promise<T | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: marshall(key),
    });
    const response = await this.client.send(command);
    return response.Item ? (unmarshall(response.Item) as T) : null;
  }

  async update(
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>
  ): Promise<T> {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: marshall(key),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues || {}),
      ReturnValues: "ALL_NEW",
    });
    const response = await this.client.send(command);
    return unmarshall(response.Attributes!) as T;
  }

  async delete(key: Record<string, any>): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: marshall(key),
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
      ExpressionAttributeValues: expressionAttributeValues
        ? marshall(expressionAttributeValues)
        : undefined,
      ExpressionAttributeNames: expressionAttributeNames,
      IndexName: indexName,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey
        ? marshall(exclusiveStartKey)
        : undefined,
    });
    const response = await this.client.send(command);
    return {
      items: (response.Items || []).map((item) => unmarshall(item) as T),
      lastEvaluatedKey: response.LastEvaluatedKey
        ? (unmarshall(response.LastEvaluatedKey) as Record<string, any>)
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
      ExpressionAttributeValues: expressionAttributeValues
        ? marshall(expressionAttributeValues)
        : undefined,
      ExpressionAttributeNames: expressionAttributeNames,
      Limit: limit,
    });
    const response = await this.client.send(command);
    return {
      items: (response.Items || []).map((item) => unmarshall(item) as T),
      lastEvaluatedKey: response.LastEvaluatedKey
        ? (unmarshall(response.LastEvaluatedKey) as Record<string, any>)
        : undefined,
    };
  }

  protected getTableName(): string {
    return this.tableName;
  }
}
