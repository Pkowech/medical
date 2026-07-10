'use client';

import { useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { xapiService } from './xapiService';
import { XAPI_VERBS, XApiVerb } from './verbs';
import { XApiResult, XApiContext, XApiObject } from './types';
import { URLS } from '@/lib/urls';

export const useXapi = (contextOverrides?: XApiContext) => {
  const params = useParams();
  const courseId = params?.courseId as string;
  const unitId = params?.unitId as string;

  const baseContext = useMemo((): XApiContext => {
    const context: XApiContext = {
      extensions: {
        [URLS.XAPI_EXTENSIONS.COURSE_ID]: courseId,
        [URLS.XAPI_EXTENSIONS.UNIT_ID]: unitId,
      },
      ...contextOverrides,
    };

    if (courseId) {
      context.contextActivities = {
        parent: [
          {
            id: URLS.COURSE(courseId),
            definition: {
              name: { 'en-US': `Course ${courseId}` },
              type: 'http://adlnet.gov/expapi/activities/course',
            },
          },
        ],
      };
    }

    return context;
  }, [courseId, unitId, contextOverrides]);

  const trackAction = useCallback(
    (
      verb: XApiVerb,
      object: XApiObject,
      result?: XApiResult,
      additionalContext?: XApiContext
    ) => {
      const mergedContext: XApiContext = {
        ...baseContext,
        ...additionalContext,
        extensions: {
          ...baseContext.extensions,
          ...(additionalContext?.extensions || {}),
        },
        contextActivities: {
          ...baseContext.contextActivities,
          ...(additionalContext?.contextActivities || {}),
        },
      };

      return xapiService.sendStatement(verb, object, result, mergedContext);
    },
    [baseContext]
  );

  // Convenience methods for common tracking patterns
  const createObject = useCallback(
    ({
      objectId,
      objectName,
      activityType,
      courseId: objectCourseId,
    }: {
      objectId: string;
      objectName: string;
      activityType: string;
      courseId?: string;
    }): XApiObject => ({
      id: `${URLS.BASE}/activities/${objectCourseId || courseId || 'unknown'}/${objectId}`,
      definition: {
        name: { 'en-US': objectName },
        type: `http://adlnet.gov/expapi/activities/${activityType.toLowerCase()}`,
      },
    }),
    [courseId]
  );

  const trackViewed = useCallback(
    (params: { objectId: string; objectName: string; activityType: string; courseId?: string }) => {
      const object = createObject(params);
      return trackAction(XAPI_VERBS.EXPERIENCED, object);
    },
    [createObject, trackAction]
  );

  const trackCompleted = useCallback(
    (params: { objectId: string; objectName: string; activityType: string; courseId?: string }, result?: XApiResult) => {
      const object = createObject(params);
      return trackAction(XAPI_VERBS.COMPLETED, object, result);
    },
    [createObject, trackAction]
  );

  const trackProgressed = useCallback(
    (params: { objectId: string; objectName: string; activityType: string; courseId?: string }, progress: number) => {
      const object = createObject(params);
      return trackAction(XAPI_VERBS.PROGRESSED, object, {
        extensions: {
          [URLS.XAPI_EXTENSIONS.PROGRESS]: progress,
        },
      });
    },
    [createObject, trackAction]
  );

  const trackLaunched = useCallback(
    (params: { objectId: string; objectName: string; activityType: string; courseId?: string }) => {
      const object = createObject(params);
      return trackAction(XAPI_VERBS.LAUNCHED, object);
    },
    [createObject, trackAction]
  );

  return {
    XAPI_VERBS,
    trackAction,
    trackViewed,
    trackCompleted,
    trackProgressed,
    trackLaunched,
    courseId,
    unitId,
  };
};
