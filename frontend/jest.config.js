const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Handle CSS imports (with CSS modules)
    // https://jestjs.io/docs/webpack#mocking-css-modules
    '^.+\.module\.(css|sass|scss)$': 'identity-obj-proxy',

    // Handle image imports
    // https://jestjs.io/docs/webpack#handling-static-assets
    '^.+\.(\\png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$': '<rootDir>/__mocks__/fileMock.js',

    // Handle next/font
    '@next/font/(.*)': '<rootDir>/__mocks__/nextFontMock.js',
    // Handle next/image
    '^next/image$': '<rootDir>/__mocks__/nextImageMock.js',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/mocks/',
    '<rootDir>/jest.setup.js', // Ignore jest.setup.js from being treated as a test file
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**',
    '!src/lib/next-auth/**',
    '!src/proxy.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/src/types/',
    '/src/lib/next-auth/',
    '/src/proxy.ts',
  ],
  transform: {
    // Use babel-jest to transpile tests with the Next.js babel preset
    // https://jestjs.io/docs/configuration#transform
    '^.+\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\.module\.(css|sass|scss)$', // Ignore CSS modules
  ],
  // Add more setup options before each test is run
  // setupFiles: ['<rootDir>/jest.setup.js'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
