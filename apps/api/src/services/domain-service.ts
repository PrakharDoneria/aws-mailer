import {
  SESClient,
  VerifyDomainIdentityCommand,
  VerifyDomainDkimCommand,
  DeleteIdentityCommand,
  GetIdentityVerificationAttributesCommand,
  GetIdentityDkimAttributesCommand,
  SetIdentityDkimEnabledCommand,
} from "@aws-sdk/client-ses";
import {
  Domain,
  DomainDNSRecords,
  MailForgeError,
  ErrorCodes,
  generateId,
  getCurrentTimestamp,
  isValidDomain,
  generateVerificationToken,
} from "@mailforge/shared";
import { DomainRepository } from "../repositories/domain-repository";
import { CreateDomain } from "@mailforge/validation";

export class DomainService {
  private repository: DomainRepository;
  private sesClient: SESClient;

  constructor() {
    this.repository = new DomainRepository();
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  async createDomain(
    organizationId: string,
    input: CreateDomain
  ): Promise<Domain> {
    try {
      // Validate domain format
      if (!isValidDomain(input.domainName)) {
        throw new MailForgeError(
          ErrorCodes.INVALID_DOMAIN,
          "Invalid domain format",
          400
        );
      }

      // Check if domain already exists
      const existing = await this.repository.getByDomainName(input.domainName);
      if (existing) {
        throw new MailForgeError(
          ErrorCodes.ALREADY_EXISTS,
          "Domain already registered",
          409
        );
      }

      // Create domain record
      const domain: Domain = {
        id: generateId(),
        organizationId,
        domainName: input.domainName,
        status: "pending",
        verificationToken: generateVerificationToken(),
        dkimStatus: "pending",
        spfStatus: "pending",
        dmarcStatus: "pending",
        inboundEnabled: false,
        outboundEnabled: false,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      };

      await this.repository.create(domain);

      // Request domain identity verification from SES
      await this.sesClient.send(
        new VerifyDomainIdentityCommand({
          Domain: input.domainName,
        })
      );

      return domain;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("CreateDomain error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to create domain",
        500
      );
    }
  }

  async getDomain(id: string): Promise<Domain> {
    const domain = await this.repository.getById(id);
    if (!domain) {
      throw new MailForgeError(ErrorCodes.NOT_FOUND, "Domain not found", 404);
    }
    return domain;
  }

  async getOrganizationDomains(organizationId: string): Promise<Domain[]> {
    return this.repository.getOrganizationDomains(organizationId);
  }

  async getDNSRecords(domainName: string): Promise<DomainDNSRecords> {
    // In production, these would be generated based on domain configuration
    const verificationToken = generateVerificationToken();

    // SES typically provides these records
    return {
      verification: {
        type: "TXT",
        name: `_amazonses.${domainName}`,
        value: verificationToken,
        required: true,
      },
      dkim: [
        {
          type: "CNAME",
          name: `token1._domainkey.${domainName}`,
          value: `token1.dkim.amazonses.com`,
          required: true,
        },
        {
          type: "CNAME",
          name: `token2._domainkey.${domainName}`,
          value: `token2.dkim.amazonses.com`,
          required: true,
        },
        {
          type: "CNAME",
          name: `token3._domainkey.${domainName}`,
          value: `token3.dkim.amazonses.com`,
          required: true,
        },
      ],
      spf: {
        type: "TXT",
        name: domainName,
        value: `v=spf1 include:amazonses.com ~all`,
        required: true,
      },
      dmarc: {
        type: "TXT",
        name: `_dmarc.${domainName}`,
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domainName}`,
        required: false,
      },
      mx: {
        type: "MX",
        name: domainName,
        value: `10 inbound-smtp.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`,
        priority: 10,
        required: true,
      },
    };
  }

  async verifyDomain(id: string): Promise<Domain> {
    try {
      const domain = await this.getDomain(id);

      // Check SES verification status
      const verifyResponse = await this.sesClient.send(
        new GetIdentityVerificationAttributesCommand({
          Identities: [domain.domainName],
        })
      );

      const attributes = verifyResponse.VerificationAttributes?.[domain.domainName];

      if (!attributes) {
        throw new MailForgeError(
          ErrorCodes.DOMAIN_VERIFICATION_FAILED,
          "Domain not found in SES",
          400
        );
      }

      if (
        attributes.VerificationStatus !== "Success" &&
        attributes.VerificationStatus !== "Pending"
      ) {
        throw new MailForgeError(
          ErrorCodes.DOMAIN_VERIFICATION_FAILED,
          `Domain verification failed: ${attributes.VerificationStatus}`,
          400
        );
      }

      // Enable DKIM
      await this.sesClient.send(
        new SetIdentityDkimEnabledCommand({
          Identity: domain.domainName,
          DkimEnabled: true,
        })
      );

      // Update domain status
      const updated = await this.repository.update(id, {
        status: "verified",
        dkimStatus: "verified",
        spfStatus: "verified",
        inboundEnabled: true,
        outboundEnabled: true,
      } as Partial<Domain>);

      return updated;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("VerifyDomain error:", error);
      throw new MailForgeError(
        ErrorCodes.DOMAIN_VERIFICATION_FAILED,
        "Failed to verify domain",
        400
      );
    }
  }

  async deleteDomain(id: string): Promise<void> {
    try {
      const domain = await this.getDomain(id);

      // Delete from SES
      await this.sesClient.send(
        new DeleteIdentityCommand({
          Identity: domain.domainName,
        })
      );

      // Delete from database
      await this.repository.delete(id);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("DeleteDomain error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to delete domain",
        500
      );
    }
  }

  async checkVerificationStatus(id: string): Promise<Domain> {
    try {
      const domain = await this.getDomain(id);

      // Check SES verification status
      const verifyResponse = await this.sesClient.send(
        new GetIdentityVerificationAttributesCommand({
          Identities: [domain.domainName],
        })
      );

      const dkimResponse = await this.sesClient.send(
        new GetIdentityDkimAttributesCommand({
          Identities: [domain.domainName],
        })
      );

      const verifyAttrs = verifyResponse.VerificationAttributes?.[domain.domainName];
      const dkimAttrs = dkimResponse.DkimAttributes?.[domain.domainName];

      // Update domain with current status
      let dkimStatus: "pending" | "verified" | "failed" = "pending";
      let spfStatus: "pending" | "verified" | "failed" = "pending";

      if (dkimAttrs?.DkimVerificationStatus === "Success") {
        dkimStatus = "verified";
      }

      if (verifyAttrs?.VerificationStatus === "Success") {
        spfStatus = "verified";
      }

      const updated = await this.repository.update(id, {
        status: verifyAttrs?.VerificationStatus === "Success" ? "verified" : "pending",
        dkimStatus,
        spfStatus,
      } as Partial<Domain>);

      return updated;
    } catch (error) {
      console.error("CheckVerificationStatus error:", error);
      // Return existing domain if check fails
      return this.getDomain(id);
    }
  }
}
