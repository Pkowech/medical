import { getData, postData, deleteData } from '../../auth/services/apiClient';
import { TwoFactorAuthStatus, Session } from '@/shared/types/systemInterface';

export const getTwoFactorAuthStatus = async (): Promise<TwoFactorAuthStatus | null> => {
  try {
    const response = await getData<TwoFactorAuthStatus>('/auth/2fa/status');
    return response?.data || null;
  } catch (err) {
    console.warn('getTwoFactorAuthStatus: API unavailable', err);
    return null;
  }
};

export const enableTwoFactorAuth = async (
  method: 'app' | 'sms'
): Promise<TwoFactorAuthStatus | null> => {
  try {
    const response = await postData<TwoFactorAuthStatus>('/auth/2fa/enable', { method });
    return response?.data || null;
  } catch (err) {
    console.warn('enableTwoFactorAuth: API unavailable', err);
    return null;
  }
};

export const disableTwoFactorAuth = async (): Promise<TwoFactorAuthStatus | null> => {
  try {
    const response = await postData<TwoFactorAuthStatus>('/auth/2fa/disable');
    return response?.data || null;
  } catch (err) {
    console.warn('disableTwoFactorAuth: API unavailable', err);
    return null;
  }
};

export const getUserSessions = async (): Promise<Session[]> => {
  try {
    const response = await getData<Session[]>('/auth/sessions');
    return (Array.isArray(response?.data) ? response.data : []);
  } catch (err) {
    console.warn('getUserSessions: API unavailable, returning empty list', err);
    return [];
  }
};

export const terminateSession = async (sessionId: string): Promise<boolean> => {
  try {
    await deleteData<void>(`/auth/sessions/${sessionId}`);
    return true;
  } catch (err) {
    console.warn('terminateSession: API unavailable or failed', err);
    return false;
  }
};
