module.exports = {
    testEnvironment: 'node',
    testTimeout: 30000,
    globalSetup: './jest.globalSetup.js',
    globalTeardown: './jest.globalTeardown.js',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'app.js',
        'middleware/**/*.js',
        'routes/**/*.js',
        'models/**/*.js',
        '!node_modules/**',
    ],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 60,
            lines: 60,
            statements: 60,
        },
    },
    testMatch: ['**/__tests__/**/*.test.js'],
};
