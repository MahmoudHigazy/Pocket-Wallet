/** Jest covers pure TS only: domain, sync engine, and the DB layer (via better-sqlite3). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/domain', '<rootDir>/src/sync', '<rootDir>/src/db'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/domain/**/*.ts', '!**/*.test.ts'],
};
