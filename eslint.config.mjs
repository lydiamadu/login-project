import js from '@eslint/js';

export default [
    {
        ignores: ['node_modules/', 'coverage/', 'eslint.config.mjs'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^err$' }],
            'no-console': 'off',
            'no-undef': 'error',
            'eqeqeq': 'error',
            'no-var': 'error',
            'prefer-const': 'warn',
            'no-duplicate-imports': 'error',
        },
    },
    {
        files: ['__tests__/**/*.js', 'jest.setup.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly',
            },
        },
    },
];
