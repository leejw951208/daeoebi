// 환경변수 선로드. main.ts 최상단에서 가장 먼저 import 하여 AppModule(및 auth.types 의
// EXPECTED_ORIGINS·RP_ID·RP_NAME 같은 top-level env 상수, CSRF 미들웨어의 ALLOWED_ORIGINS)
// 평가 전에 process.env 를 채운다.
//
// 배경: NestJS ConfigModule 은 import 그래프 평가보다 늦게 .env 를 로드하므로, 모듈 로드
// 시점에 캡처되는 상수가 기본값으로 굳는다(예: dev 포트 변경 시 CSRF Origin 거부). dotenv 로
// 미리 채우면 dev 에서도 정확한 값이 잡힌다. 운영은 컨테이너가 env 를 주입하고 .env 파일이
// 없으므로 이 로드는 no-op(이미 설정된 값은 덮어쓰지 않는다).
import { config } from "dotenv"

const nodeEnv = process.env.NODE_ENV ?? "development"
config({
    // ConfigModule 의 envFilePath 와 동일 우선순위. override:false(기본)로 주입된 값 보존.
    path: [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, ".env.local", ".env"],
})
