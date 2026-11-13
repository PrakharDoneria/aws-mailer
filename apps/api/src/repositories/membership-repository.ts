import { OrganizationMembership, UserRole } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class MembershipRepository extends BaseRepository<OrganizationMembership> {
  constructor() {
    super(process.env.MEMBERSHIPS_TABLE!);
  }

  async create(membership: OrganizationMembership): Promise<void> {
    await super.create(membership);
  }

  async getByOrgAndUser(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMembership | null> {
    return super.get({ organizationId, userId });
  }

  async getOrganizationMembers(organizationId: string): Promise<OrganizationMembership[]> {
    const result = await super.query(
      "organizationId = :orgId",
      { ":orgId": organizationId },
      undefined,
      undefined
    );
    return result.items;
  }

  async updateRole(
    organizationId: string,
    userId: string,
    role: UserRole
  ): Promise<OrganizationMembership> {
    return super.updateItem(
      { organizationId, userId },
      "SET #role = :role",
      { "#role": "role" },
      { ":role": role }
    );
  }

  async remove(organizationId: string, userId: string): Promise<void> {
    await super.deleteItem({ organizationId, userId });
  }
}
