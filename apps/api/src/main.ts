// NestJS 진입점. 127.0.0.1:4000 바인딩과 CORS, 검증 파이프, 예외 필터를 설정한다.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

function resolveSqlitePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith('file:')) {
    return null;
  }
  const raw = databaseUrl.slice('file:'.length);
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function assertDatabaseWritable(databaseUrl: string): void {
  const dbPath = resolveSqlitePath(databaseUrl);
  if (!dbPath) {
    return;
  }

  const dir = path.dirname(dbPath);
  try {
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    if (fs.existsSync(dbPath)) {
      fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    }
  } catch (error) {
    Logger.error(
      `SQLite DB 파일 권한을 확인해 주세요. 경로. ${dbPath}. 원인. ${(error as Error).message}`,
      'Bootstrap'
    );
    process.exit(1);
  }
}

async function bootstrap() {
  // DATABASE_URL 누락 시 명시적 한국어 에러로 즉시 종료한다.
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    Logger.error(
      'DATABASE_URL 환경 변수가 설정되어 있지 않습니다. apps/api/.env.example을 참고해 .env 파일을 만들어주세요.',
      'Bootstrap'
    );
    process.exit(1);
  }
  assertDatabaseWritable(databaseUrl);

  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.enableCors({
    origin: 'http://127.0.0.1:3000',
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(4000, '127.0.0.1');
}

bootstrap();
