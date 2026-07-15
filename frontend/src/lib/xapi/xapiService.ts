import { apiService } from '@/features/auth/services/apiClient';
import { authService } from '@/features/auth/services/authService';
import { XApiVerb } from './verbs';
import { XApiObject, XApiResult, XApiContext, XApiStatement } from './types';

class XApiService {
  private static instance: XApiService;
  private statementQueue: XApiStatement[] = [];
  private isProcessingQueue = false;

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

      // Instead of sending immediately, push to queue and process
      this.statementQueue.push(statement);
      this.processQueue();
    } catch (error) {
      console.error('XApiService: Failed to queue xAPI statement:', error);
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.statementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.statementQueue.length > 0) {
      // Get the next statement
      const statement = this.statementQueue.shift();
      if (!statement) continue;

      try {
        console.warn('XApiService: Sending queued xAPI statement', { 
          verb: statement.verb?.id, 
          actor: statement.actor?.name,
          object: statement.object?.id 
        });
        
        await apiService.post('/progress/statements', statement);
      } catch (error) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error);
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        console.error('XApiService: Failed to send xAPI statement:', errorMessage, error);
      }

      // Wait 1000ms between requests to avoid 429 Too Many Requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessingQueue = false;
  }
}

export const xapiService = XApiService.getInstance();
export default xapiService;
