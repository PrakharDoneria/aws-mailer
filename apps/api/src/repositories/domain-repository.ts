import { Domain, DomainStatus } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class DomainRepository extends BaseRepository<Domain> {
  constructor() {
    super(process.env.DOMAINS_TABLE!);
  }

  async create(domain: Domain): Promise<void> {
    await super.create(domain);
  }

  async getById(id: string): Promise<Domain | null> {
    return super.get({ id });
  }

  async getByDomainName(domainName: string): Promise<Domain | null> {
    const result = await super.query(
      "domainName = :domainName",
      { domainName },
      undefined,
      "domain-name-index"
    );
    return result.items.length > 0 ? result.items[0] : null;
  }

  async getOrganizationDomains(organizationId: string): Promise<Domain[]> {
    const result = await super.query(
      "organizationId = :orgId",
      { orgId: organizationId },
      undefined,
      "org-domain-index"
    );
    return result.items;
  }

  async update(id: string, updates: Partial<Domain>): Promise<Domain> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      if (key === "id" || key === "organizationId" || key === "domainName")
        return; // Skip immutable fields
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

  async updateStatus(id: string, status: DomainStatus): Promise<Domain> {
    return this.update(id, { status } as Partial<Domain>);
  }

  async delete(id: string): Promise<void> {
    await super.delete({ id });
  }
}
