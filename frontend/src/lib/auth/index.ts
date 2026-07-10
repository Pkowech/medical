import { TokenManager } from './tokenManager';

export const getAuthToken = () => {
  return TokenManager.getAccessToken();
};
