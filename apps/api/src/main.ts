// NestJS 진입점. localhost:4000 바인딩과 CORS, 검증 파이프, 예외 필터를 설정한다.
import { NestFactory } from "@nestjs/core"
import { ValidationPipe, Logger } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./common/http-exception.filter"

// 요청 본문 크기 상한. import 등 대용량 페이로드의 메모리 고갈(M-2)을 막는다.
const BODY_LIMIT = process.env.BODY_LIMIT ?? "5mb"

async function bootstrap() {
    // DATABASE_URL 누락 시 명시적 한국어 에러로 즉시 종료한다.
    const databaseUrl = process.env.DATABASE_URL?.trim()
    if (!databaseUrl) {
        Logger.error(
            "DATABASE_URL 환경 변수가 설정되어 있지 않습니다. apps/api/.env.example 을 복사해 .env.development(또는 .env.production) 파일을 만들어주세요.",
            "Bootstrap",
        )
        process.exit(1)
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule)
    app.getHttpAdapter().getInstance().disable("x-powered-by")

    // 리버스 프록시(cloudflared) 뒤에서 X-Forwarded-* 헤더를 신뢰한다.
    // 운영에서 TRUST_PROXY=1 로 켜야 req.ip·protocol 이 실제 클라이언트 값으로 잡힌다. 미설정(개발)이면 비활성.
    const trustProxy = process.env.TRUST_PROXY?.trim()
    if (trustProxy) {
        app.set(
            "trust proxy",
            /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
        )
    }

    // same-origin 배포에서는 API_GLOBAL_PREFIX=api 로 /api 하위에 서비스한다.
    // cloudflared 가 /api/* 경로를 strip 없이 전달하므로 서버가 프리픽스를 받아야 한다. 미설정(개발)이면 프리픽스 없음.
    const globalPrefix = process.env.API_GLOBAL_PREFIX?.trim()
    if (globalPrefix) {
        app.setGlobalPrefix(globalPrefix)
    }

    // 명시적 body limit 으로 기본값에 의존하지 않는다(M-2 DoS 방어).
    app.useBodyParser("json", { limit: BODY_LIMIT })
    app.useBodyParser("urlencoded", { extended: true, limit: BODY_LIMIT })
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        )
        res.setHeader("X-Content-Type-Options", "nosniff")
        res.setHeader("Referrer-Policy", "no-referrer")
        next()
    })

    // 허용 웹 오리진. CORS_ORIGIN 을 쉼표로 구분해 여러 개 지정할 수 있다.
    // 미설정 시 로컬 개발 오리진(localhost / 127.0.0.1) 둘 다 허용한다.
    const corsOrigins = (
        process.env.CORS_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000"
    )
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    })

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )

    app.useGlobalFilters(new HttpExceptionFilter())

    // 기본은 듀얼스택(::) 바인딩 — localhost(IPv6 ::1)와 127.0.0.1(IPv4) 모두로 접속된다.
    // 컨테이너에선 HOST=0.0.0.0 으로 덮어쓴다.
    const port = Number(process.env.PORT ?? 4000)
    const host = process.env.HOST ?? "::"
    await app.listen(port, host)
}

bootstrap()
