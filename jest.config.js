module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./src/tests/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/'
  ],
  moduleNameMapper: {
    '^src/cloudCode/models/(.*)$': '<rootDir>/src/tests/__mocks__/emptyModel.ts',
  },
};
