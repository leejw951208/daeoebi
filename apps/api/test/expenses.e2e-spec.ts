// 정기 지출 마스터 생성 → occurrences 조회 → 완료 처리 e2e 시나리오.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_DB_PATH = path.join(__dirname, 'tmp-e2e.db');

describe('Expenses & Occurrences e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

    // 로컬에 설치된 prisma 바이너리를 직접 호출해 PATH 의존을 제거한다.
    const prismaBin = path.join(__dirname, '..', 'node_modules', '.bin', 'prisma');
    execSync(`"${prismaBin}" migrate deploy`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}`, RUST_LOG: 'info' }
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // 각 테스트는 자신만의 fixture를 만들도록 한다. 순서 의존을 제거한다.
  beforeEach(async () => {
    await prisma.expenseOccurrence.deleteMany();
    await prisma.recurringExpense.deleteMany();
  });

  it('마스터 생성 시 12개월치 occurrence가 자동 생성된다', async () => {
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post('/expenses')
      .send({
        name: '넷플릭스',
        category: '구독',
        amount: 17000,
        recurrence: 'MONTHLY',
        dayOfMonth: 15,
        startDate: '2099-01-15'
      })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    const expenseId = createRes.body.id as string;

    const occRes = await request(server)
      .get('/occurrences')
      .query({ from: '2099-01-01', to: '2100-12-31' })
      .expect(200);

    expect(occRes.body).toHaveLength(12);
    expect(occRes.body[0].expectedAmount).toBe(17000);
    expect(occRes.body[0].status).toBe('SCHEDULED');
    expect(occRes.body[0].expense.id).toBe(expenseId);
  });

  it('인스턴스를 완료 처리하면 상태와 실제 금액이 반영된다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '넷플릭스',
        category: '구독',
        amount: 17000,
        recurrence: 'MONTHLY',
        dayOfMonth: 15,
        startDate: '2099-01-15'
      })
      .expect(201);

    const occRes = await request(server).get('/occurrences').expect(200);
    const target = occRes.body[0];

    const updated = await request(server)
      .patch(`/occurrences/${target.id}`)
      .send({ status: 'PAID', actualAmount: 18000 })
      .expect(200);

    expect(updated.body.status).toBe('PAID');
    expect(updated.body.actualAmount).toBe(18000);
    expect(updated.body.paidAt).not.toBeNull();
  });

  it('PAID인데 actualAmount 미입력이면 예상 금액으로 폴백한다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '관리비',
        category: '주거',
        amount: 200000,
        recurrence: 'MONTHLY',
        dayOfMonth: 25,
        startDate: '2099-01-25'
      })
      .expect(201);

    const occRes = await request(server).get('/occurrences').expect(200);
    const target = occRes.body[0];

    const updated = await request(server)
      .patch(`/occurrences/${target.id}`)
      .send({ status: 'PAID' })
      .expect(200);

    expect(updated.body.status).toBe('PAID');
    expect(updated.body.actualAmount).toBe(200000);
  });

  it('상태만 PATCH해도 기존 메모가 보존된다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '카드',
        category: '카드',
        amount: 100000,
        recurrence: 'MONTHLY',
        dayOfMonth: 5,
        startDate: '2099-01-05'
      })
      .expect(201);

    const occRes = await request(server).get('/occurrences').expect(200);
    const target = occRes.body[0];

    // 먼저 메모를 저장한다.
    await request(server)
      .patch(`/occurrences/${target.id}`)
      .send({ status: 'PAID', actualAmount: 100000, memo: '보존되어야 함' })
      .expect(200);

    // memo 없이 상태만 다시 PATCH.
    const second = await request(server)
      .patch(`/occurrences/${target.id}`)
      .send({ status: 'PAID', actualAmount: 110000 })
      .expect(200);

    expect(second.body.memo).toBe('보존되어야 함');
  });

  it('memo: null을 보내면 메모가 비워진다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '카드',
        category: '카드',
        amount: 100000,
        recurrence: 'MONTHLY',
        dayOfMonth: 5,
        startDate: '2099-01-05'
      })
      .expect(201);

    const occRes = await request(server).get('/occurrences').expect(200);
    const target = occRes.body[0];

    await request(server)
      .patch(`/occurrences/${target.id}`)
      .send({ status: 'PAID', actualAmount: 100000, memo: '메모' })
      .expect(200);

    const cleared = await request(server)
      .patch(`/occurrences/${target.id}`)
      .send({ status: 'PAID', actualAmount: 100000, memo: null })
      .expect(200);

    expect(cleared.body.memo).toBeNull();
  });

  it('PATCH로 dayOfMonth만 변경해도 99 같은 범위 외 값은 거부된다', async () => {
    const server = app.getHttpServer();

    const create = await request(server)
      .post('/expenses')
      .send({
        name: '관리비',
        category: '주거',
        amount: 200000,
        recurrence: 'MONTHLY',
        dayOfMonth: 5,
        startDate: '2099-01-05'
      })
      .expect(201);

    await request(server).patch(`/expenses/${create.body.id}`).send({ dayOfMonth: 99 }).expect(400);
  });

  it('PATCH로 endDate에 빈 문자열을 보내면 종료일이 제거된다', async () => {
    const server = app.getHttpServer();

    const create = await request(server)
      .post('/expenses')
      .send({
        name: '단기 구독',
        category: '구독',
        amount: 10000,
        recurrence: 'MONTHLY',
        dayOfMonth: 1,
        startDate: '2099-01-01',
        endDate: '2099-06-01'
      })
      .expect(201);

    const cleared = await request(server)
      .patch(`/expenses/${create.body.id}`)
      .send({ endDate: '' })
      .expect(200);

    expect(cleared.body.endDate).toBeNull();
  });

  it('카테고리 필터로 occurrence를 조회한다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: 'A',
        category: '구독',
        amount: 1000,
        recurrence: 'MONTHLY',
        dayOfMonth: 1,
        startDate: '2099-01-01'
      })
      .expect(201);

    await request(server)
      .post('/expenses')
      .send({
        name: 'B',
        category: '카드',
        amount: 2000,
        recurrence: 'MONTHLY',
        dayOfMonth: 1,
        startDate: '2099-01-01'
      })
      .expect(201);

    const onlySubs = await request(server)
      .get('/occurrences')
      .query({ category: '구독' })
      .expect(200);

    expect(onlySubs.body.length).toBeGreaterThan(0);
    expect(onlySubs.body.every((o: { expense: { category: string } }) => o.expense.category === '구독')).toBe(true);
  });

  it('합계 응답에 basisCounts와 카테고리/결제수단/상태별 합계가 포함된다', async () => {
    const server = app.getHttpServer();

    const expense = await request(server)
      .post('/expenses')
      .send({
        name: '카드',
        category: '카드',
        amount: 100000,
        paymentMethod: '신한카드',
        recurrence: 'MONTHLY',
        dayOfMonth: 5,
        startDate: '2099-01-05'
      })
      .expect(201);

    // 한 건만 PAID로 처리한다.
    const occRes = await request(server).get('/occurrences').expect(200);
    await request(server)
      .patch(`/occurrences/${occRes.body[0].id}`)
      .send({ status: 'PAID', actualAmount: 110000 })
      .expect(200);

    const sum = await request(server)
      .get('/summary')
      .query({ from: '2099-01-01', to: '2099-12-31' })
      .expect(200);

    expect(sum.body.basisCounts).toBeDefined();
    expect(sum.body.basisCounts.actual).toBe(1);
    expect(sum.body.basisCounts.expected).toBeGreaterThan(0);
    expect(Array.isArray(sum.body.byCategory)).toBe(true);
    expect(sum.body.byCategory.find((b: { key: string }) => b.key === '카드')).toBeDefined();
    expect(sum.body.byPaymentMethod.find((b: { key: string }) => b.key === '신한카드')).toBeDefined();
    expect(sum.body.byStatus.find((b: { key: string }) => b.key === 'PAID')).toBeDefined();

    void expense;
  });

  it('동일 인스턴스를 두 번 완료하면 마지막 입력으로 덮어쓴다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '카드',
        category: '카드',
        amount: 100000,
        recurrence: 'MONTHLY',
        dayOfMonth: 5,
        startDate: '2099-01-05'
      })
      .expect(201);

    const occRes = await request(server).get('/occurrences').expect(200);
    const id = occRes.body[0].id;

    await request(server)
      .patch(`/occurrences/${id}`)
      .send({ status: 'PAID', actualAmount: 100000 })
      .expect(200);
    const second = await request(server)
      .patch(`/occurrences/${id}`)
      .send({ status: 'PAID', actualAmount: 120000 })
      .expect(200);

    expect(second.body.actualAmount).toBe(120000);
  });

  it('종료일이 시작일 이전이면 400을 반환한다', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/expenses')
      .send({
        name: '잘못된 일정',
        category: '기타',
        amount: 1000,
        recurrence: 'MONTHLY',
        dayOfMonth: 1,
        startDate: '2099-06-01',
        endDate: '2099-05-01'
      })
      .expect(400);

    expect(res.body.message).toContain('종료일');
  });

  it('CSV 내보내기는 UTF-8 BOM과 한국어 헤더를 포함한다', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '넷플릭스',
        category: '구독',
        amount: 17000,
        recurrence: 'MONTHLY',
        dayOfMonth: 15,
        startDate: '2099-01-15'
      })
      .expect(201);

    const res = await request(server)
      .get('/export/csv')
      .query({ from: '2099-01-01', to: '2100-12-31' })
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    const body = res.text;
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain('이름');
    expect(body).toContain('카테고리');
    expect(body).toContain('넷플릭스');
  });

  it('CSV 셀 첫 글자가 =+-@이면 작은따옴표가 prepend된다(CSV 인젝션 방지)', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/expenses')
      .send({
        name: '=cmd|exploit',
        category: '카드',
        amount: 1000,
        recurrence: 'MONTHLY',
        dayOfMonth: 1,
        startDate: '2099-01-01'
      })
      .expect(201);

    const res = await request(server)
      .get('/export/csv')
      .query({ from: '2099-01-01', to: '2100-12-31' })
      .expect(200);

    // CSV에 작은따옴표가 prepend된 셀이 있어야 한다.
    expect(res.text).toContain(`,'=cmd|exploit,`);
  });
});
