import { Organization, MailForgeError, ErrorCodes, generateId, getCurrentTimestamp, OrgUsageLimits, PLANS } from "@mailforge/shared";
import { OrganizationRepository } from "../repositories/organization-repository";
import { CreateOrganization } from "@mailforge/validation";

export class OrganizationService {
  private repository: OrganizationRepository;

  constructor() {
    this.repository = new OrganizationRepository();
  }

  async createOrganization(
    input: CreateOrganization,
    ownerId: string
  ): Promise<Organization> {
    const organization: Organization = {
      id: generateId(),
      ownerId,
      name: input.name,
      plan: input.plan || "free",
      status: "active",
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };

    await this.repository.create(organization);
    return organization;
  }

  async getOrganization(id: string): Promise<Organization> {
    const org = await this.repository.getById(id);
    if (!org) {
      throw new MailForgeError(
        ErrorCodes.NOT_FOUND,
        "Organization not found",
        404
      );
    }
    return org;
  }

  async getOrganizationsByOwner(ownerId: string): Promise<Organization[]> {
    return this.repository.getByOwnerId(ownerId);
  }

  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization> {
    // Prevent updating protected fields
    delete (updates as any).id;
    delete (updates as any).ownerId;
    delete (updates as any).createdAt;

    return this.repository.update(id, updates);
  }

  async deleteOrganization(id: string): Promise<void> {
    // In real implementation, check for active domains/mailboxes first
    await this.repository.delete(id);
  }

  getUsageLimits(plan: string): OrgUsageLimits {
    const planConfig = PLANS[plan as keyof typeof PLANS];
    if (!planConfig) {
      throw new MailForgeError(
        ErrorCodes.INVALID_INPUT,
        `Unknown plan: ${plan}`,
        400
      );
    }

    return {
      domainsMax: planConfig.domainsMax,
      mailboxesMax: planConfig.mailboxesMax,
      storageMax: planConfig.storageBytesMax,
      emailsPerDay: planConfig.emailsPerDay,
      apiRequestsPerHour: planConfig.apiRequestsPerHour,
    };
  }

  async validateOrganizationAccess(
    organizationId: string,
    userId: string,
    requiredRole?: string
  ): Promise<boolean> {
    // In real implementation, check membership table
    // For now, simplified check
    return true;
  }
}
