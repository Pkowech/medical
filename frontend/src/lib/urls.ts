const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://medtrackhub.com';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const URLS = {
  BASE,
  API_BASE,
  APP_URL,
  XAPI_EXTENSIONS: {
    COURSE_ID: `${BASE}/xapi/extensions/course-id`,
    UNIT_ID: `${BASE}/xapi/extensions/unit-id`,
    PROGRESS: `${BASE}/xapi/extensions/progress`,
  },
  COURSE: (courseId: string) => `${BASE}/courses/${courseId}`,
};

export const THIRD_PARTY = {
  PDFJS_WORKER: (version = '') => `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`,
};

export default URLS;
