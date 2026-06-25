// e2e 테스트 환경 변수 로더. 테스트 모듈 그래프 평가 전에 DATABASE_URL 등을 주입한다(prisma.config.ts 와 동일 순서).
// cwd 에 의존하지 않도록 apps/api 루트(이 파일의 상위)를 기준으로 절대 경로를 만든다.
import { config as loadEnv } from "dotenv"
import * as path from "node:path"

const ROOT = path.join(__dirname, "..")
// jest 는 NODE_ENV=test 를 강제하지만 e2e 는 로컬 개발 DB(.env.development)를 대상으로 한다.
// .env.test* 가 있으면 우선 적용하고, 없으면 .env.development 로 폴백한다(override 없이 먼저 set 된 값 유지).
loadEnv({ path: path.join(ROOT, ".env.test.local") })
loadEnv({ path: path.join(ROOT, ".env.test") })
loadEnv({ path: path.join(ROOT, ".env.development.local") })
loadEnv({ path: path.join(ROOT, ".env.development") })
loadEnv({ path: path.join(ROOT, ".env.local") })
loadEnv({ path: path.join(ROOT, ".env") })

// 첫 등록 부트스트랩 게이트(e044723) 때문에 첫 passkey 등록 e2e 는 서버에 토큰이 설정돼
// 있어야 한다. dev .env 의 값에 의존하지 않도록 테스트 토큰을 고정 주입한다(spec 의 헬퍼가
// 같은 값을 register/verify 본문에 싣는다). 운영/개발 동작은 건드리지 않는다.
process.env.BOOTSTRAP_TOKEN = "e2e-bootstrap-token"
