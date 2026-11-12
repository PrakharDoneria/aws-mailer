import { User } from "@mailforge/shared";
import { BaseRepository } from "./base-repository";

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(process.env.USERS_TABLE!);
  }

  async create(user: User): Promise<void> {
    await super.create(user);
  }

  async getById(id: string): Promise<User | null> {
    return super.get({ id });
  }

  async getByEmail(email: string): Promise<User | null> {
    const result = await super.query(
      "email = :email",
      { email },
      undefined,
      "email-index"
    );
    return result.items.length > 0 ? result.items[0] : null;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      if (key === "id") return; // Skip ID
      const placeholder = `:val${index}`;
      updateExpressions.push(`#${key} = ${placeholder}`);
      expressionAttributeValues[placeholder] = value;
      expressionAttributeNames[`#${key}`] = key;
    });

    return super.update(
      { id },
      `SET ${updateExpressions.join(", ")}`,
      expressionAttributeNames,
      expressionAttributeValues
    );
  }

  async delete(id: string): Promise<void> {
    await super.delete({ id });
  }
}
