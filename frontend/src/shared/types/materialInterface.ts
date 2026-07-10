import { BaseEntity } from './systemInterface';

/**
 * Material Types
 */
export enum MaterialType {
  DOCUMENT = 'document',
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  FLASHCARD = 'flashcard',
  QUIZ = 'quiz',
  ASSIGNMENT = 'assignment',
}

/**
 * Base Material Properties
 */
export interface MaterialBase extends BaseEntity {
  title: string;
  description: string;
  contentType: MaterialType;
  content: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}

/**
 * Extended Material Interface
 */
export interface Material extends MaterialBase {
  materialId: string;
  // Backwards compatibility: `type` used in older components; prefer `contentType`.
  type?: string;
  unitId?: number;
  author?: string;
  source?: string;
  answer?: string;
  url?: string;
  uploadDate?: string;
  size?: string;
  fileUrl?: string;
  unit?: {
    id: number;
    name: string;
    order: number;
  };
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  analytics?: {
    views: number;
    completions: number;
    averageRating: number;
    timeSpent: number;
    difficulty: number;
  };
  metadata?: {
    createdAt: string;
    source: string;
    learningObjectives?: string[];
    prerequisites?: string[];
    estimatedTime?: number;
    relatedMaterials?: string[];
  };
}

/**
 * Material Creation Interface
 */
export interface CreateMaterial extends Omit<MaterialBase, 'id' | 'createdAt' | 'updatedAt'> {
  materialId: string;
  unitId?: number;
  author?: string;
  source?: string;
  answer?: string;
  userId: string;
}

/**
 * Material Update Interface
 */
export interface UpdateMaterial extends Partial<CreateMaterial> {}

export interface AppFile {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  key?: string;
  hash?: string;
  uploadedById?: string;
  createdAt: string;
  updatedAt: string;
}
