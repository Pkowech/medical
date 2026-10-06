import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { google, drive_v3 } from 'googleapis';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

const MAX_DRIVE_MATERIAL_BYTES = 100 * 1024 * 1024;
const MAX_FOLDER_IMPORT_FILES = 500;
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export interface SharedDriveFolderFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string;
  folderPath: string;
  supported: boolean;
}

const SUPPORTED_DRIVE_FILE_TYPES = new Set([
  'application/pdf',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
]);

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private driveClient?: drive_v3.Drive;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getConnectionStatus(userId: string): Promise<{ connected: boolean }> {
    const connection = await this.prisma.googleDriveConnection.findUnique({
      where: { userId },
      select: { id: true },
    });
    return { connected: Boolean(connection) };
  }

  async isUserConnected(userId: string): Promise<boolean> {
    const status = await this.getConnectionStatus(userId);
    return status.connected;
  }

  getAuthorizationUrl(userId: string): string {
    this.getEncryptionKey();
    const payload = Buffer.from(JSON.stringify({
      userId,
      issuedAt: Date.now(),
      nonce: randomBytes(16).toString('hex'),
    })).toString('base64url');
    const signature = createHmac('sha256', this.getStateSecret())
      .update(payload)
      .digest('base64url');
    return this.getOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_READONLY_SCOPE],
      state: `${payload}.${signature}`,
    });
  }

  async completeAuthorization(code: string, state: string): Promise<string> {
    const userId = this.verifyOAuthState(state);
    const oauthClient = this.getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    const previous = await this.prisma.googleDriveConnection.findUnique({
      where: { userId },
      select: { encryptedRefreshToken: true },
    });
    const refreshToken = tokens.refresh_token
      ?? (previous ? this.decryptRefreshToken(previous.encryptedRefreshToken) : undefined);
    if (!refreshToken) {
      throw new BadRequestException(
        'Google did not grant offline Drive access. Reconnect and approve the requested access.',
      );
    }

    await this.prisma.googleDriveConnection.upsert({
      where: { userId },
      create: { userId, encryptedRefreshToken: this.encryptRefreshToken(refreshToken) },
      update: { encryptedRefreshToken: this.encryptRefreshToken(refreshToken) },
    });
    return userId;
  }

  async disconnectUser(userId: string): Promise<void> {
    const connection = await this.prisma.googleDriveConnection.findUnique({
      where: { userId },
      select: { encryptedRefreshToken: true },
    });
    if (!connection) return;
    try {
      const refreshToken = this.decryptRefreshToken(connection.encryptedRefreshToken);
      await this.getOAuthClient().revokeToken(refreshToken);
    } catch {
      this.logger.warn('Google Drive token revocation failed; removing the local connection anyway');
    }
    await this.prisma.googleDriveConnection.deleteMany({ where: { userId } });
  }

  extractFileId(input: string): string {
    let url: URL;
    try {
      url = new URL(input.trim());
    } catch {
      throw new BadRequestException('Enter a valid Google Drive file URL.');
    }

    const host = url.hostname.toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') {
      throw new BadRequestException('Only Google Drive or Google Docs URLs are supported.');
    }

    const pathId = url.pathname.match(/\/folders\/([^/]+)|\/file\/d\/([^/]+)|\/document\/d\/([^/]+)|\/spreadsheets\/d\/([^/]+)|\/presentation\/d\/([^/]+)/);
    const fileId = pathId?.slice(1).find(Boolean) || url.searchParams.get('id');
    if (!fileId || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) {
      throw new BadRequestException('The URL does not contain a valid Drive file ID.');
    }
    return fileId;
  }

  async listSharedDriveFolder(input: string, userId: string): Promise<{
    folderId: string;
    folderName: string;
    files: SharedDriveFolderFile[];
  }> {
    const folderId = this.extractFileId(input);
    try {
      const { drive, personal } = await this.getDriveClient(userId, true);
      const driveId = personal ? undefined : this.config.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
      if (!personal && !driveId) {
        throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
      }
      const rootResponse = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'id,name,mimeType,driveId,trashed',
      });
      const root = rootResponse.data;
      if (
        root.trashed ||
        (!personal && root.driveId !== driveId) ||
        root.mimeType !== 'application/vnd.google-apps.folder'
      ) {
        throw new BadRequestException(
          personal
            ? 'Choose a folder that your connected Google account can access.'
            : 'Choose a folder in the configured MedTrack Shared Drive.',
        );
      }
      if (!root.id || !root.name) {
        throw new BadRequestException('Google Drive did not return the folder details.');
      }

      const files: SharedDriveFolderFile[] = [];
      const visitedFolders = new Set<string>([root.id]);
      const walkFolder = async (parentId: string, path: string[]): Promise<void> => {
        let pageToken: string | undefined;
        do {
          const response: drive_v3.Schema$FileList = (await drive.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            ...(personal ? { corpora: 'user' as const } : { corpora: 'drive' as const, driveId }),
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            pageSize: 1000,
            pageToken,
            fields: 'nextPageToken,files(id,name,mimeType,size,driveId,webViewLink,trashed)',
          })).data;

          for (const entry of response.files ?? []) {
            if (entry.trashed || !entry.id || !entry.name || (!personal && entry.driveId !== driveId)) continue;
            if (entry.mimeType === 'application/vnd.google-apps.folder') {
              if (visitedFolders.has(entry.id)) continue;
              visitedFolders.add(entry.id);
              await walkFolder(entry.id, [...path, entry.name]);
              continue;
            }

            files.push({
              id: entry.id,
              name: entry.name,
              mimeType: entry.mimeType ?? 'application/octet-stream',
              size: Number(entry.size || 0),
              webViewLink: entry.webViewLink ?? undefined,
              folderPath: path.join('/'),
              supported: SUPPORTED_DRIVE_FILE_TYPES.has(entry.mimeType ?? ''),
            });
            if (files.length > MAX_FOLDER_IMPORT_FILES) {
              throw new BadRequestException(
                `This folder contains more than ${MAX_FOLDER_IMPORT_FILES} files. Import a smaller subfolder at a time.`,
              );
            }
          }
          pageToken = response.nextPageToken ?? undefined;
        } while (pageToken);
      };

      await walkFolder(root.id, []);
      return { folderId: root.id, folderName: root.name, files };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error('Could not list Google Drive folder', error);
      throw new BadRequestException(
        'MedTrack cannot read this folder. Confirm it is shared with your connected Google account.',
      );
    }
  }

  async getSharedDriveFile(input: string, userId?: string): Promise<drive_v3.Schema$File> {
    const fileId = this.extractFileId(input);
    try {
      const { drive, personal } = await this.getDriveClient(userId);
      const driveId = personal ? undefined : this.config.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
      if (!personal && !driveId) {
        throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
      }
      const response = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id,name,mimeType,size,driveId,webViewLink,trashed',
      });
      const file = response.data;
      if (file.trashed || (!personal && file.driveId !== driveId)) {
        throw new BadRequestException(
          personal
            ? 'The file is not accessible to your connected Google account.'
            : 'The file must be in the configured MedTrack Shared Drive and not in trash.',
        );
      }
      if (!file.id || !file.name || !file.mimeType) {
        throw new BadRequestException('Google Drive did not return the required file details.');
      }
      const size = Number(file.size || 0);
      if (size > MAX_DRIVE_MATERIAL_BYTES) {
        throw new BadRequestException('Drive materials must be 100 MB or smaller.');
      }
      return file;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Could not access Google Drive file', error);
      throw new BadRequestException(
        'MedTrack cannot access this file. Confirm it is shared with your connected Google account.',
      );
    }
  }

  async downloadFile(fileId: string, mimeType: string, userId?: string): Promise<Buffer> {
    try {
      const { drive, personal } = await this.getDriveClient(userId, Boolean(userId));
      const driveId = personal ? undefined : this.config.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
      if (!personal && !driveId) throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
      const file = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id,size,driveId,trashed',
      });
      if (file.data.trashed || (!personal && file.data.driveId !== driveId)) {
        throw new BadRequestException(
          personal
            ? 'The Drive file is no longer accessible to the connected Google account.'
            : 'The Drive file is no longer available in the configured Shared Drive.',
        );
      }
      if (Number(file.data.size || 0) > MAX_DRIVE_MATERIAL_BYTES) {
        throw new BadRequestException('Drive materials must be 100 MB or smaller.');
      }

      const googleDocumentTypes = new Set([
        'application/vnd.google-apps.document',
        'application/vnd.google-apps.spreadsheet',
        'application/vnd.google-apps.presentation',
      ]);
      const response = googleDocumentTypes.has(mimeType)
        ? await drive.files.export(
            { fileId, mimeType: 'application/pdf' },
            { responseType: 'stream' },
          )
        : await drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' },
          );
      const stream = response.data;
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > MAX_DRIVE_MATERIAL_BYTES) {
          stream.destroy();
          throw new BadRequestException('Drive materials must be 100 MB or smaller.');
        }
        chunks.push(buffer);
      }
      return Buffer.concat(chunks, totalBytes);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Could not download Google Drive material', error);
      throw new ServiceUnavailableException('Unable to read this material from Google Drive.');
    }
  }

  private async getDriveClient(
    userId?: string,
    requirePersonal = false,
  ): Promise<{ drive: drive_v3.Drive; personal: boolean }> {
    if (userId) {
      const connection = await this.prisma.googleDriveConnection.findUnique({
        where: { userId },
        select: { encryptedRefreshToken: true },
      });
      if (connection) {
        const oauthClient = this.getOAuthClient();
        oauthClient.setCredentials({
          refresh_token: this.decryptRefreshToken(connection.encryptedRefreshToken),
        });
        return { drive: google.drive({ version: 'v3', auth: oauthClient }), personal: true };
      }
    }
    if (requirePersonal) {
      throw new BadRequestException('Connect your Google Drive account before browsing folders.');
    }
    return { drive: this.getInstitutionalClient(), personal: false };
  }

  private getInstitutionalClient(): drive_v3.Drive {
    if (this.driveClient) return this.driveClient;
    const rawCredentials = this.config.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    if (!rawCredentials) {
      throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
    }

    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(rawCredentials) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException('Google Drive service-account JSON is invalid.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  private getOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_DRIVE_OAUTH_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Personal Google Drive OAuth is not configured.');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getStateSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new ServiceUnavailableException('OAuth state signing is not configured.');
    return secret;
  }

  private verifyOAuthState(state: string): string {
    const [payload, signature, extra] = state.split('.');
    if (!payload || !signature || extra) throw new BadRequestException('Google OAuth state is invalid.');
    const expected = createHmac('sha256', this.getStateSecret()).update(payload).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'base64url');
    } catch {
      throw new BadRequestException('Google OAuth state is invalid.');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException('Google OAuth state validation failed.');
    }

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        userId?: string;
        issuedAt?: number;
      };
      if (
        !decoded.userId ||
        typeof decoded.issuedAt !== 'number' ||
        Date.now() - decoded.issuedAt > OAUTH_STATE_MAX_AGE_MS ||
        decoded.issuedAt > Date.now() + 30_000
      ) {
        throw new Error('expired');
      }
      return decoded.userId;
    } catch {
      throw new BadRequestException('Google OAuth state is invalid or expired.');
    }
  }

  private encryptRefreshToken(refreshToken: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
  }

  private decryptRefreshToken(encryptedToken: string): string {
    try {
      const [ivValue, tagValue, encryptedValue] = encryptedToken.split('.');
      if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid token format');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(ivValue, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('Stored Google Drive credentials cannot be decrypted.');
    }
  }

  private getEncryptionKey(): Buffer {
    const encodedKey = this.config.get<string>('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY');
    const key = encodedKey ? Buffer.from(encodedKey, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
      );
    }
    return key;
  }
}