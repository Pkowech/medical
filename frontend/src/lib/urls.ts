const ensureProtocol = (urlStr: string, fallback: string): string => {
  let val = (urlStr || fallback).trim();
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    val = `https://${val}`;
  }
  try {
    new URL(val);
    return val.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
};

const getDynamicOrigin = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  let val = raw.trim();
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    const protocol = val.includes('localhost') ? 'http://' : 'https://';
    val = `${protocol}${val}`;
  }
  try {
    return new URL(val).origin;
  } catch {
    return 'http://localhost:3000';
  }
};

const BASE = getDynamicOrigin();
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || `${BASE}/v1`).replace(/\/+$/, '');
const APP_URL = BASE;

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
