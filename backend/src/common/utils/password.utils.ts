import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordUtils {
  private static readonly saltRounds = 12;
  private static readonly memoryCost = 65536;
  private static readonly timeCost = 3;
  private static readonly parallelism = 4;

  static async hash(password: string): Promise<string> {
    const h = await argon2.hash(password, {
      timeCost: this.timeCost,
      memoryCost: this.memoryCost,
      parallelism: this.parallelism,
    } as any);
    // Ensure we always return a string even if the lib types allow Buffer
    return h as unknown as string;
  }

  static async compare(password: string, hashed: string): Promise<boolean> {
    return argon2.verify(hashed, password);
  }

  static validateStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
