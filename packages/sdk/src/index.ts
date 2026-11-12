import axios, { AxiosInstance } from 'axios';

export interface ClientConfig {
  apiKey?: string;
  apiUrl?: string;
  token?: string;
}

export class MailForge {
  private api: AxiosInstance;
  private config: ClientConfig;

  constructor(config: ClientConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'https://api.mailforge.io',
      ...config,
    };

    this.api = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(config.token && { Authorization: `Bearer ${config.token}` }),
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
      },
    });
  }

  // Auth
  async signUp(email: string, password: string, name: string) {
    return this.api.post('/v1/auth/sign-up', { email, password, name });
  }

  async signIn(email: string, password: string) {
    return this.api.post('/v1/auth/sign-in', { email, password });
  }

  // Organizations
  async createOrganization(name: string, plan = 'free') {
    return this.api.post('/v1/organizations', { name, plan });
  }

  async listOrganizations() {
    return this.api.get('/v1/organizations');
  }

  async getOrganization(id: string) {
    return this.api.get(`/v1/organizations/${id}`);
  }

  async updateOrganization(id: string, data: Record<string, any>) {
    return this.api.patch(`/v1/organizations/${id}`, data);
  }

  // Domains
  async createDomain(orgId: string, domainName: string) {
    return this.api.post(`/v1/organizations/${orgId}/domains`, { domainName });
  }

  async listDomains(orgId: string) {
    return this.api.get(`/v1/organizations/${orgId}/domains`);
  }

  async verifyDomain(orgId: string, domainId: string) {
    return this.api.post(`/v1/organizations/${orgId}/domains/${domainId}/verify`);
  }

  async getDNSRecords(orgId: string, domainId: string) {
    return this.api.get(`/v1/organizations/${orgId}/domains/${domainId}/dns-records`);
  }

  // Mailboxes
  async createMailbox(orgId: string, domainId: string, localPart: string, displayName: string) {
    return this.api.post(`/v1/organizations/${orgId}/mailboxes`, {
      domainId,
      localPart,
      displayName,
    });
  }

  async listMailboxes(orgId: string) {
    return this.api.get(`/v1/organizations/${orgId}/mailboxes`);
  }

  async getMailbox(orgId: string, mailboxId: string) {
    return this.api.get(`/v1/organizations/${orgId}/mailboxes/${mailboxId}`);
  }

  // Messages
  async sendEmail(orgId: string, data: {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    textBody?: string;
    htmlBody?: string;
    idempotencyKey?: string;
  }) {
    return this.api.post(`/v1/organizations/${orgId}/messages/send`, data);
  }

  async listMessages(orgId: string, mailboxId: string, limit = 50) {
    return this.api.get(`/v1/messages`, {
      params: { mailboxId, limit },
    });
  }

  async getMessage(orgId: string, messageId: string) {
    return this.api.get(`/v1/messages/${messageId}`);
  }

  // Drafts
  async createDraft(orgId: string, data: Record<string, any>) {
    return this.api.post(`/v1/organizations/${orgId}/messages/drafts`, data);
  }

  async listDrafts(orgId: string, mailboxId: string) {
    return this.api.get(`/v1/messages/drafts`, {
      params: { mailboxId },
    });
  }

  async updateDraft(orgId: string, draftId: string, data: Record<string, any>) {
    return this.api.patch(`/v1/messages/drafts/${draftId}`, data);
  }

  async sendDraft(orgId: string, draftId: string) {
    return this.api.post(`/v1/messages/drafts/${draftId}/send`);
  }

  async deleteDraft(orgId: string, draftId: string) {
    return this.api.delete(`/v1/messages/drafts/${draftId}`);
  }

  // API Keys
  async createAPIKey(orgId: string, name: string, permissions: string[]) {
    return this.api.post(`/v1/api-keys`, { name, permissions });
  }

  async listAPIKeys(orgId: string) {
    return this.api.get(`/v1/api-keys`);
  }

  async deleteAPIKey(keyId: string) {
    return this.api.delete(`/v1/api-keys/${keyId}`);
  }
}

export default MailForge;
