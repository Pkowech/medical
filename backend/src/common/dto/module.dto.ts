export interface LearningModuleType {
  id: string;
  type: 'course' | 'assessment' | 'clinical_case' | 'resource' | 'milestone';
  resourceId: string;
  title?: string;
  required?: boolean;
  order?: number;
  estimatedMinutes?: number;
  passingScore?: number;
}

export interface LearningModule extends LearningModuleType {
  prerequisites?: string[];
  objectives?: string[];
  metadata?: Record<string, any>;
}
