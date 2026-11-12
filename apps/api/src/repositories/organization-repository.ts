import { Organization } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super(process.env.ORGANIZATIONS_TABLE!);
  }

  async create(organization: Organization): Promise<void> {
    await super.create(organization);
  }

  async getById(id: string): Promise<Organization | null> {
    return super.get({ id });
  }

  async update(id: string, updates: Partial<Organization>): Promise<Organization> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value], index) => {
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

  async getByOwnerId(ownerId: string): Promise<Organization[]> {
    const result = await super.query(
      "ownerId = :ownerId",
      { ownerId },
      undefined,
      "owner-index"
    );
    return result.items;
  }

  async delete(id: string): Promise<void> {
    await super.delete({ id });
  }
}
