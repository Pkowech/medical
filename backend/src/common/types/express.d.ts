import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User; // Or a more specific type if you have one for authenticated users
      cookies?: { [key: string]: string }; // Add cookies property
    }
  }
}
