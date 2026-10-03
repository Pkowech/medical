const path = require('path');
const webpack = require('webpack');

// ============================================================================
// ENVIRONMENT & CONSTANTS
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';
const projectRoot = path.resolve(__dirname);
// Use the standard relative `.next` directory. Turbopack rejects output
// directories that navigate outside the project path, so keep the default here.
const distDir = '.next';

const ALLOWED_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://[IP_ADDRESS]',
  'http://192.168.137.1:3000'
];

const configuredBackendUrl = process.env.BACKEND_URL || '';
const BACKEND_URL = configuredBackendUrl.replace(/\/v1\/?$/, '');

// ============================================================================
// PWA CONFIGURATION
// ============================================================================

/**
 * Get PWA runtime caching strategies
 * Organizes cache strategies by endpoint category and HTTP method
 */
const getPWACacheStrategies = () => [
  {
    // Never cache potentially private page HTML; serve the document fallback offline.
    urlPattern: ({ request }) => request.mode === 'navigate',
    handler: 'NetworkOnly',
    options: {},
  },
  {
    // API responses can contain private user data; never persist them in Cache Storage.
    urlPattern: /^https?:\/\/[^/]+\/api(?:\/|$)/i,
    handler: 'NetworkOnly',
    options: {},
  },
  {
    urlPattern: /^https?:\/\/[^/]+\/_next\/static\//i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'medtrack-static-v1',
      expiration: {
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https?:\/\/[^/]+\/(?:images|icons|fonts)\/.*\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?)$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'medtrack-public-assets-v1',
      expiration: {
        maxEntries: 150,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
];

/**
 * Initialize PWA plugin
 * Only loads PWA in production to avoid dev server issues
 */
const initializePWA = () => {
  if (isDev) {
    return cfg => cfg; // No-op in development
  }

  try {
    return require('next-pwa')({
      dest: 'public',
      register: false,
      skipWaiting: false,
      clientsClaim: true,
      cacheOnFrontEndNav: false,
      disable: false,
      customWorkerDir: 'worker',
      fallbacks: {
        document: '/offline.html',
      },
      runtimeCaching: getPWACacheStrategies(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      '[PWA] Failed to load next-pwa, continuing without PWA support:',
      error instanceof Error ? error.message : String(error)
    );
    return cfg => cfg;
  }
};

const withPWA = initializePWA();

// ============================================================================
// WEBPACK CONFIGURATION
// ============================================================================

/**
 * Configure webpack aliases for path resolution
 */
const setupWebpackAliases = config => {
  config.resolve.alias['@'] = path.join(__dirname, 'src');

  // Shim canvas for client-side bundling (used by pdf-parse/pdfjs-dist)
  const canvasShim = path.join(__dirname, 'src', 'shims', 'canvas-shim.ts');
  config.resolve.alias['canvas'] = canvasShim;
  config.resolve.alias['canvas/lib/bindings'] = canvasShim;
};

/**
 * Configure client-side webpack fallbacks and externals
 */
const setupClientFallbacks = config => {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    crypto: false,
    stream: false,
    url: false,
    zlib: false,
    http: false,
    https: false,
    assert: false,
    os: false,
    path: false,
    canvas: false,
  };
};

/**
 * Configure external dependencies (Node-only modules)
 */
const setupExternals = config => {
  config.externals = config.externals || [];
  config.externals.push(
    { '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node' },
    { ioredis: 'commonjs ioredis' },
    // Canvas is shimmed via alias, not needed here
  );
};

/**
 * Main webpack configuration handler
 */
const configureWebpack = (config, { isServer }) => {
  setupWebpackAliases(config);

  if (!isServer) {
    setupClientFallbacks(config);
    setupExternals(config);
  } else {
    // Server-side: only exclude specific Node-only modules
    setupExternals(config);
  }

  return config;
};

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Generate CSP header based on environment
 */
const getContentSecurityPolicy = () => {
  const baseCSP =
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.youtube.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com; font-src 'self'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; worker-src 'self' blob:";

  if (isProd) {
    return `${baseCSP}; connect-src 'self' blob: https://*.amazonaws.com wss://*.amazonaws.com; frame-ancestors 'none'; block-all-mixed-content`;
  }

  return `${baseCSP}; connect-src 'self' blob: http://localhost:* ws://localhost:* wss://localhost:* https://*.amazonaws.com`;
};

/**
 * Configure security headers
 */
const getSecurityHeaders = () => [
  {
    source: '/:path*',
    headers: [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value:
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
      },
      {
        key: 'Content-Security-Policy',
        value: getContentSecurityPolicy(),
      },
    ],
  },
];

// ============================================================================
// REWRITES & ROUTING
// ============================================================================

/**
 * Keep direct `/v1` rewrites for legacy server-generated URLs. Browser API
 * calls use the same-origin route handler at `/api/backend/*`, which must not
 * be captured by a broad `/api/*` rewrite.
 */
const getApiRewrites = () => [
  {
    // Proxy direct /v1 requests (used by some backend-generated URLs like local material files)
    source: '/v1/:path*',
    destination: `${BACKEND_URL}/v1/:path*`,
  },
];

// ============================================================================
// NEXT.JS CONFIGURATION
// ============================================================================

/**
 * Get working directory for output tracing
 */
const getOutputTracingRoot = () => {
  const cwd = process.cwd();
  return cwd.endsWith('/frontend') ? `${cwd}/..` : cwd;
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ========== BUILD & OUTPUT ==========
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  productionBrowserSourceMaps: false,
  distDir,
  outputFileTracingRoot: projectRoot,

  // ========== RUNTIME ENV ==========
  env: {
    NEXTAUTH_URL:
      process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // ========== COMPILER & LINTING ==========
  compiler: {
    removeConsole: isProd,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // ========== DEVELOPER EXPERIENCE ==========
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
  turbopack: {
    root: projectRoot,
  },

  // ========== EXPERIMENTAL FEATURES ==========
  experimental: {
    serverActions: { enabled: true },
  },

  // ========== WEBPACK ==========
  webpack: configureWebpack,

  // ========== SECURITY & ROUTING ==========
  headers: getSecurityHeaders,
  rewrites: getApiRewrites,

  // ========== IMAGES ==========
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
    localPatterns: [
      {
        pathname: '/**',
        search: '?*',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);