/** Jest covers only the pure-TS domain layer (no React/Expo). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/domain', '<rootDir>/src/sync'],
  collectCoverageFrom: ['src/domain/**/*.ts', '!**/*.test.ts'],
};
