/**
 * Standard xAPI Verbs (Experience API)
 * Using ADL (Advanced Distributed Learning) standard IRIs where possible.
 */
export const XAPI_VERBS = {
  /** User has launched a learning activity (e.g., started a course) */
  LAUNCHED: {
    id: 'http://adlnet.gov/expapi/verbs/launched',
    display: { 'en-US': 'launched' },
  },
  
  /** User has initialized a learning component (e.g., entered a lesson/unit) */
  INITIALIZED: {
    id: 'http://adlnet.gov/expapi/verbs/initialized',
    display: { 'en-US': 'initialized' },
  },
  
  /** User has completed a learning activity */
  COMPLETED: {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'en-US': 'completed' },
  },
  
  /** User has experienced a learning object (e.g., viewed a material) */
  EXPERIENCED: {
    id: 'http://adlnet.gov/expapi/verbs/experienced',
    display: { 'en-US': 'experienced' },
  },
  
  /** User has made progress in a learning activity */
  PROGRESSED: {
    id: 'http://adlnet.gov/expapi/verbs/progressed',
    display: { 'en-US': 'progressed' },
  },
  
  /** User has attempted an assessment */
  ATTEMPTED: {
    id: 'http://adlnet.gov/expapi/verbs/attempted',
    display: { 'en-US': 'attempted' },
  },
  
  /** User has passed an assessment */
  PASSED: {
    id: 'http://adlnet.gov/expapi/verbs/passed',
    display: { 'en-US': 'passed' },
  },
  
  /** User has failed an assessment */
  FAILED: {
    id: 'http://adlnet.gov/expapi/verbs/failed',
    display: { 'en-US': 'failed' },
  },

  /** User has started playing a video */
  PLAYED: {
    id: 'http://adlnet.gov/expapi/verbs/played',
    display: { 'en-US': 'played' },
  },

  /** User has paused a video */
  PAUSED: {
    id: 'http://adlnet.gov/expapi/verbs/paused',
    display: { 'en-US': 'paused' },
  },
} as const;

export type XApiVerb = typeof XAPI_VERBS[keyof typeof XAPI_VERBS];
