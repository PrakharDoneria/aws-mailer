import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  MessageActionType,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  User,
  MailForgeError,
  ErrorCodes,
  generateId,
  getCurrentTimestamp,
} from "@mailforge/shared";
import { UserRepository } from "../repositories/user-repository";
import { SignUp, SignIn, UpdateProfile } from "@mailforge/validation";

export class AuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private userRepository: UserRepository;
  private userPoolId: string;

  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
    });
    this.userRepository = new UserRepository();
    this.userPoolId = process.env.COGNITO_USER_POOL_ID!;
  }

  async signUp(input: SignUp): Promise<User> {
    try {
      // Check if user already exists
      const existing = await this.userRepository.getByEmail(input.email);
      if (existing) {
        throw new MailForgeError(
          ErrorCodes.ALREADY_EXISTS,
          "Email already registered",
          409
        );
      }

      // Create Cognito user
      await this.cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: input.email,
          UserAttributes: [
            { Name: "email", Value: input.email },
            { Name: "email_verified", Value: "true" },
            { Name: "name", Value: input.name },
          ],
          MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email
          TemporaryPassword: this.generateTemporaryPassword(),
        })
      );

      // Set permanent password
      await this.cognitoClient.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: input.email,
          Password: input.password,
          Permanent: true,
        })
      );

      // Create user in database
      const user: User = {
        id: generateId(),
        email: input.email,
        name: input.name,
        createdAt: getCurrentTimestamp(),
        status: "active",
      };

      await this.userRepository.create(user);

      return user;
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("SignUp error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to sign up",
        500
      );
    }
  }

  async signIn(input: SignIn): Promise<{ accessToken: string; idToken: string }> {
    try {
      const response = await this.cognitoClient.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.userPoolId,
          ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID!,
          AuthFlow: "ADMIN_NO_SRP_AUTH",
          AuthParameters: {
            USERNAME: input.email,
            PASSWORD: input.password,
          },
        })
      );

      if (!response.AuthenticationResult) {
        throw new MailForgeError(
          ErrorCodes.UNAUTHORIZED,
          "Invalid credentials",
          401
        );
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
      };
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("SignIn error:", error);
      throw new MailForgeError(
        ErrorCodes.UNAUTHORIZED,
        "Invalid credentials",
        401
      );
    }
  }

  async signOut(userId: string): Promise<void> {
    try {
      // Get Cognito username from user record
      const user = await this.userRepository.getById(userId);
      if (!user) {
        throw new MailForgeError(ErrorCodes.NOT_FOUND, "User not found", 404);
      }

      await this.cognitoClient.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: this.userPoolId,
          Username: user.email,
        })
      );
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("SignOut error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to sign out",
        500
      );
    }
  }

  async updateProfile(userId: string, input: UpdateProfile): Promise<User> {
    try {
      const user = await this.userRepository.getById(userId);
      if (!user) {
        throw new MailForgeError(ErrorCodes.NOT_FOUND, "User not found", 404);
      }

      // Update Cognito user attributes
      if (input.name) {
        await this.cognitoClient.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: this.userPoolId,
            Username: user.email,
            UserAttributes: [{ Name: "name", Value: input.name }],
          })
        );
      }

      // Update database record
      const updates: Partial<User> = {};
      if (input.name) updates.name = input.name;

      return this.userRepository.update(userId, updates);
    } catch (error) {
      if (error instanceof MailForgeError) {
        throw error;
      }
      console.error("UpdateProfile error:", error);
      throw new MailForgeError(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to update profile",
        500
      );
    }
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.userRepository.getById(userId);
    if (!user) {
      throw new MailForgeError(ErrorCodes.NOT_FOUND, "User not found", 404);
    }
    return user;
  }

  private generateTemporaryPassword(): string {
    const length = 12;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + symbols;

    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 3; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }
}
