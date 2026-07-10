const nextPlugin = require('@next/eslint-plugin-next');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');

const nextRecommended = {
  plugins: {
    '@next/next': nextPlugin,
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
  },
};

const tsFlatRecommended = tsPlugin.configs['flat/recommended'].map(config => {
  if (!config.languageOptions) {
    return config;
  }

  return {
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...(config.languageOptions.parserOptions || {}),
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  };
});

const projectWideRules = {
  files: ['**/*.{ts,tsx,js,jsx}'],
  rules: {
    'no-unused-vars': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-base-to-string': 'warn',
  },
};

const typeDefinitionOverrides = {
  files: ['**/*.d.ts', 'src/shared/types/**/*.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
  },
};

// ESLint configuration for Next.js (flat config)
module.exports = [
  // Include Next.js recommended rules so the plugin is detected by next build
  nextRecommended,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'scripts/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
      'public/**',
      '__tests__/**',
      'src/__tests__/**',
      'src/tests/**',
      'jest.setup.js',
      'jest.config.js',
      'next-env.d.ts',
      'src/shims/**',
    ],
  },
  ...tsFlatRecommended,
  projectWideRules,
  typeDefinitionOverrides,
];
