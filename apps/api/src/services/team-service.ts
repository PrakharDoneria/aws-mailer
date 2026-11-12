import {
  OrganizationMembership,
  User,
  UserRole,
  MailForgeError,
  ErrorCodes,
  generateId,
  getCurrentTimestamp,
} from "@mailforge/shared";
import { MembershipRepository } from "../repositories/membership-repository";
import { UserRepository } from "../repositories/user-repository";
import { InviteMember, UpdateMemberRole } from "@mailforge/validation";

export class TeamService {
  private membershipRepository: MembershipRepository;
  private userRepository: UserRepository;

  constructor() {
    this.membershipRepository = new MembershipRepository();
    this.userRepository = new UserRepository();
  }

  async inviteMember(
    organizationId: string,
    invitedByUserId: string,
    input: InviteMember
  ): Promise<OrganizationMembership> {
    try {
      // Verify inviter is admin or owner
      const inviterMembership = await this.membershipRepository.getByOrgAndUser(
        organizationId,
        invitedByUserId
      );

      if (!inviterMembership) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "User not member of organization",
          403
        );
      }

      if (
        inviterMembership.role !== "owner" &&
        inviterMembership.role !== "admin"
      ) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Only admins can invite members",
          403
        );
      }

      // Check if user exists or create placeholder
      let user = await this.userRepository.getByEmail(input.email);
      if (!user) {
        // Create placeholder user (will be activated on first login)
        user = {
          id: generateId(),
          email: input.email,
          name: input.email.split("@")[0],
          status: "inactive",
          createdAt: getCurrentTimestamp(),
        };
        await this.userRepository.create(user);
      }

      // Check if already member
      const existing = await this.membershipRepository.getByOrgAndUser(
        organizationId,
        user.id
      );
      if (existing) {
        throw new MailForgeError(
          ErrorCodes.ALREADY_EXISTS,
          "User already member of organization",
          409
        );
      }

      // Create membership
      const membership: OrganizationMembership = {
        id: generateId(),
        organizationId,
        userId: user.id,
        role: input.role,
        createdAt: getCurrentTimestamp(),
      };

      await this.membershipRepository.create(membership);

      // TODO: Send invitation email

      return membership;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("InviteMember error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to invite member",
        500
      );
    }
  }

  async getMembers(
    organizationId: string,
    userId: string
  ): Promise<(OrganizationMembership & { user: User })[]> {
    // Verify user is member
    const membership = await this.membershipRepository.getByOrgAndUser(
      organizationId,
      userId
    );
    if (!membership) {
      throw new MailForgeError(
        ErrorCodes.FORBIDDEN,
        "User not member of organization",
        403
      );
    }

    const memberships = await this.membershipRepository.getOrganizationMembers(
      organizationId
    );

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await this.userRepository.getById(m.userId);
        return {
          ...m,
          user: user || {
            id: m.userId,
            email: "",
            name: "",
            status: "inactive",
            createdAt: m.createdAt,
          },
        };
      })
    );

    return members;
  }

  async updateMemberRole(
    organizationId: string,
    updatedByUserId: string,
    targetUserId: string,
    input: UpdateMemberRole
  ): Promise<OrganizationMembership> {
    try {
      // Verify updater is admin or owner
      const updaterMembership = await this.membershipRepository.getByOrgAndUser(
        organizationId,
        updatedByUserId
      );

      if (!updaterMembership) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "User not member of organization",
          403
        );
      }

      if (
        updaterMembership.role !== "owner" &&
        updaterMembership.role !== "admin"
      ) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Only admins can change member roles",
          403
        );
      }

      // Cannot downgrade owner
      const targetMembership = await this.membershipRepository.getByOrgAndUser(
        organizationId,
        targetUserId
      );

      if (targetMembership?.role === "owner") {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Cannot change owner role",
          403
        );
      }

      // Update role
      return this.membershipRepository.updateRole(
        organizationId,
        targetUserId,
        input.role
      );
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("UpdateMemberRole error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to update member role",
        500
      );
    }
  }

  async removeMember(
    organizationId: string,
    removedByUserId: string,
    targetUserId: string
  ): Promise<void> {
    try {
      // Verify remover is admin or owner
      const removerMembership = await this.membershipRepository.getByOrgAndUser(
        organizationId,
        removedByUserId
      );

      if (!removerMembership) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "User not member of organization",
          403
        );
      }

      if (
        removerMembership.role !== "owner" &&
        removerMembership.role !== "admin"
      ) {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Only admins can remove members",
          403
        );
      }

      // Cannot remove owner
      const targetMembership = await this.membershipRepository.getByOrgAndUser(
        organizationId,
        targetUserId
      );

      if (targetMembership?.role === "owner") {
        throw new MailForgeError(
          ErrorCodes.FORBIDDEN,
          "Cannot remove owner",
          403
        );
      }

      // Remove membership
      await this.membershipRepository.remove(organizationId, targetUserId);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("RemoveMember error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to remove member",
        500
      );
    }
  }
}
