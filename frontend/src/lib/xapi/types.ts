import { XApiVerb } from './verbs';

export interface XApiActor {
  name: string;
  mbox: string; // Must be in "mailto:email@example.com" format
}

export interface XApiObject {
  id: string;
  definition: {
    name: { [key: string]: string };
    description?: { [key: string]: string };
    type?: string;
  };
}

export interface XApiResult {
  score?: {
    scaled: number;
    raw?: number;
    min?: number;
    max?: number;
  };
  success?: boolean;
  completion?: boolean;
  duration?: string; // ISO 8601 duration
  response?: string;
  extensions?: Record<string, unknown>;
}

export interface XApiContext {
  registration?: string;
  contextActivities?: {
    parent?: XApiObject[];
    grouping?: XApiObject[];
    category?: XApiObject[];
    other?: XApiObject[];
  };
  extensions?: Record<string, unknown>;
}

export interface XApiStatement {
  id?: string;
  actor?: XApiActor;
  verb: XApiVerb;
  object: XApiObject;
  result?: XApiResult;
  context?: XApiContext;
  timestamp?: string;
}
