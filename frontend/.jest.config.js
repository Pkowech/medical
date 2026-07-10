module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^next/navigation$': '<rootDir>/__tests__/mocks/next-navigation.js',
    '^next-auth/react$': '<rootDir>/__tests__/mocks/next-auth.js',
    '^next-auth/next$': '<rootDir>/__tests__/mocks/next-auth.js',
    '^@/store/useAuthStore$': '<rootDir>/__tests__/mocks/useAuthStore.js',
    '^@/services/api$': '<rootDir>/__tests__/mocks/api.js',
    '^@/shared/components/ui$': '<rootDir>/src/components/ui/index.ts',
    '^@/lib/utils$': '<rootDir>/src/lib/utils.ts',
    '\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/mocks/',
    '<rootDir>/src/__tests__/mocks/',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
    '<rootDir>/__tests__/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  transform: {
    '^.+\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!next-auth|jose|openid-client)/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/types/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
