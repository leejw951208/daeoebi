// apps/web 의 순수 TypeScript 헬퍼용 jest 설정. UI/React 컴포넌트는 대상 외(jsdom 미도입).
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'app',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../$1'
  },
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { module: 'commonjs', target: 'ES2022', esModuleInterop: true } }]
  },
  testEnvironment: 'node'
};
