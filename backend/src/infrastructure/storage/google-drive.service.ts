import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';

const MAX_DRIVE_MATERIAL_BYTES = 100 * 1024 * 1024;
const MAX_FOLDER_IMPORT_FILES = 500;

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

  constructor(private readonly config: ConfigService) {}

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

  async listSharedDriveFolder(input: string): Promise<{
    folderId: string;
    folderName: string;
    files: SharedDriveFolderFile[];
  }> {
    const driveId = this.config.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    if (!driveId) {
      throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
    }

    const folderId = this.extractFileId(input);
    try {
      const drive = this.getClient();
      const rootResponse = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'id,name,mimeType,driveId,trashed',
      });
      const root = rootResponse.data;
      if (
        root.trashed ||
        root.driveId !== driveId ||
        root.mimeType !== 'application/vnd.google-apps.folder'
      ) {
        throw new BadRequestException(
          'Choose a folder in the configured MedTrack Shared Drive.',
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
            corpora: 'drive',
            driveId,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            pageSize: 1000,
            pageToken,
            fields: 'nextPageToken,files(id,name,mimeType,size,driveId,webViewLink,trashed)',
          })).data;

          for (const entry of response.files ?? []) {
            if (entry.trashed || !entry.id || !entry.name || entry.driveId !== driveId) continue;
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
        'MedTrack cannot read this folder. Confirm it is in the configured Shared Drive and shared with the MedTrack service account.',
      );
    }
  }

  async getSharedDriveFile(input: string): Promise<drive_v3.Schema$File> {
    const driveId = this.config.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    if (!driveId) {
      throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
    }

    const fileId = this.extractFileId(input);
    try {
      const response = await this.getClient().files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id,name,mimeType,size,driveId,webViewLink,trashed',
      });
      const file = response.data;
      if (file.trashed || file.driveId !== driveId) {
        throw new BadRequestException('The file must be in the configured MedTrack Shared Drive and not in trash.');
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
      throw new BadRequestException('MedTrack cannot access this file. Confirm it is in the configured Shared Drive and shared with the MedTrack service account.');
    }
  }

  async downloadFile(fileId: string, mimeType: string): Promise<Buffer> {
    try {
      const driveId = this.config.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
      if (!driveId) throw new ServiceUnavailableException('Google Shared Drive integration is not configured.');
      const drive = this.getClient();
      const file = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id,size,driveId,trashed',
      });
      if (file.data.trashed || file.data.driveId !== driveId) {
        throw new BadRequestException('The Drive file is no longer available in the configured Shared Drive.');
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

  private getClient(): drive_v3.Drive {
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
}