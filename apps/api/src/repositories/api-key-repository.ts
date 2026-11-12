import { APIKey } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class APIKeyRepository extends BaseRepository<APIKey> {
  constructor() {
    super(process.env.API_KEYS_TABLE!);
  }

  async create(key: APIKey): Promise<void> {
    await super.create(key);
  }

  async getById(id: string): Promise<APIKey | null> {
    return super.get({ id });
  }

  async getByKeyHash(keyHash: string): Promise<APIKey | null> {
    const result = await super.query(
      "keyHash = :keyHash",
      { keyHash },
      undefined,
      "key-hash-index"
    );
    return result.items.length > 0 ? result.items[0] : null;
  }

  async getOrganizationKeys(organizationId: string): Promise<APIKey[]> {
    const result = await super.query(
      "organizationId = :orgId",
      { orgId: organizationId },
      undefined,
      "org-key-index"
    );
    return result.items;
  }

  async revoke(id: string): Promise<APIKey> {
    return super.updateItem(
      { id },
      "SET revokedAt = :now",
      undefined,
      { ":now": Math.floor(Date.now() / 1000) }
    );
  }

  async delete(id: string): Promise<void> {
    await super.deleteItem({ id });
  }
}
