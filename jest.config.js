module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./src/tests/setup.ts'],
  moduleNameMapper: {
    '^src/cloudCode/models/(.*)$': '<rootDir>/src/tests/__mocks__/emptyModel.ts',
    '^.+/models/(.*)$': '<rootDir>/src/tests/__mocks__/emptyModel.ts'
  }
};
