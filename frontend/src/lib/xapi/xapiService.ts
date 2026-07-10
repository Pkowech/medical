import { apiService } from '@/features/auth/services/apiClient';
import { authService } from '@/features/auth/services/authService';
import { XApiVerb } from './verbs';
import { XApiObject, XApiResult, XApiContext, XApiStatement } from './types';

class XApiService {
  private static instance: XApiService;

  private constructor() {}

  static getInstance(): XApiService {
    if (!XApiService.instance) {
      XApiService.instance = new XApiService();
    }
    return XApiService.instance;
  }

  async sendStatement(
    verb: XApiVerb,
    object: XApiObject,
    result?: XApiResult,
    context?: XApiContext
  ): Promise<void> {
    try {
      const user = await authService.getSessionUser();
      if (!user) {
        console.warn('XApiService: No user session found, skipping xAPI statement');
        return;
      }

      const statement: XApiStatement = {
        actor: {
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.username || 'Anonymous User',
          mbox: `mailto:${user.email}`,
        },
        verb,
        object,
        result,
        context,
        timestamp: new Date().toISOString(),
      };

      // Validate statement structure before sending
      if (!statement.verb?.id) {
        console.warn('XApiService: Invalid verb structure in statement', { verb, statement });
      }
      if (!statement.object?.id) {
        console.warn('XApiService: Invalid object structure in statement', { object, statement });
      }

      console.debug('XApiService: Sending xAPI statement', { 
        verb: statement.verb?.id, 
        actor: statement.actor?.name,
        object: statement.object?.id 
      });

      await apiService.post('/progress/statements', statement);
    } catch (error) {
      // Properly format error for logging
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      console.error('XApiService: Failed to send xAPI statement:', errorMessage, error);
      // Don't re-throw - xAPI statement failures should not break the main application flow
    }
  }
}

export const xapiService = XApiService.getInstance();
export default xapiService;
