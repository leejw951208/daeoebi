// vault 도메인 비즈니스 로직. setup/unlock/CRUD/export/import 를 조립한다.
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VaultCryptoService } from './vault-crypto.service';
import { VaultSessionService } from './vault-session.service';
import { VaultBackoffService } from './vault-backoff.service';
import { CategoryPayloadDto } from './dto/category-payload.dto';
import { ImportMode } from './dto/import-query.dto';
import {
  EXPORT_MAGIC,
  EXPORT_VERSION,
  KDF_V1,
  MIN_UNLOCK_DURATION_MS,
  VAULT_ERRORS,
  VERIFY_PLAINTEXT,
  VaultCategory
} from './vault.types';

function normalizeMaster(input: string): string {
  return input.normalize('NFKC').trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EntryView {
  id: string;
  category: VaultCategory;
  label: string;
  createdAt: string;
  updatedAt: string;
  payload?: Record<string, unknown>;
}

export interface StatusView {
  state: 'setup-required' | 'locked' | 'unlocked';
  idleSecondsRemaining?: number;
}

interface ExportContainer {
  magic: typeof EXPORT_MAGIC;
  version: number;
  kdf: {
    version: number;
    algorithm: string;
    memoryKiB: number;
    iterations: number;
    parallelism: number;
    salt: string;
  };
  payload: {
    iv: string;
    ciphertext: string;
    authTag: string;
  };
}

interface ExportPayload {
  entries: Array<{
    category: VaultCategory;
    label: string;
    body: Record<string, unknown>;
  }>;
}

@Injectable()
export class VaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: VaultCryptoService,
    private readonly session: VaultSessionService,
    private readonly backoff: VaultBackoffService
  ) {}

  async status(): Promise<StatusView> {
    const master = await this.prisma.vaultMaster.findUnique({ where: { id: 'singleton' } });
    if (!master) return { state: 'setup-required' };
    if (this.session.isUnlocked()) {
      const remaining = this.session.idleSecondsRemaining();
      return { state: 'unlocked', idleSecondsRemaining: remaining ?? undefined };
    }
    return { state: 'locked' };
  }

  async setup(rawMaster: string): Promise<void> {
    const existing = await this.prisma.vaultMaster.findUnique({ where: { id: 'singleton' } });
    if (existing) {
      throw new ConflictException({ code: VAULT_ERRORS.SETUP_EXISTS, message: '마스터가 이미 설정되어 있습니다.' });
    }
    const master = normalizeMaster(rawMaster);
    if (master.length < 8) {
      throw new BadRequestException({
        code: VAULT_ERRORS.VALIDATION_FAILED,
        message: '정규화 후 마스터가 8자 미만입니다.'
      });
    }

    const salt = this.crypto.generateSalt();
    const key = await this.crypto.deriveKey(master, salt);
    const verify = this.crypto.seal(key, Buffer.from(VERIFY_PLAINTEXT, 'utf8'));

    await this.prisma.vaultMaster.create({
      data: {
        id: 'singleton',
        kdfVersion: KDF_V1.version,
        kdfAlgorithm: KDF_V1.algorithm,
        kdfMemoryKiB: KDF_V1.memoryKiB,
        kdfIterations: KDF_V1.iterations,
        kdfParallelism: KDF_V1.parallelism,
        salt,
        verifyIv: verify.iv,
        verifyCiphertext: verify.ciphertext,
        verifyAuthTag: verify.authTag
      }
    });

    this.session.setKey(key);
    this.backoff.reset();
  }

  async unlock(rawMaster: string): Promise<void> {
    if (this.backoff.isBlocked()) {
      throw new HttpException(
        {
          code: VAULT_ERRORS.RATE_LIMITED,
          message: '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
          retryAfterSeconds: this.backoff.retryAfterSeconds()
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const started = Date.now();
    const master = normalizeMaster(rawMaster);

    const record = await this.prisma.vaultMaster.findUnique({ where: { id: 'singleton' } });
    if (!record) {
      await this.padDelay(started);
      throw new BadRequestException({
        code: VAULT_ERRORS.VALIDATION_FAILED,
        message: '마스터가 설정되지 않았습니다.'
      });
    }

    const key = await this.crypto.deriveKey(master, Buffer.from(record.salt), {
      version: record.kdfVersion,
      algorithm: 'argon2id',
      memoryKiB: record.kdfMemoryKiB,
      iterations: record.kdfIterations,
      parallelism: record.kdfParallelism,
      saltLength: record.salt.length
    });

    const verifyResult = this.crypto.open(key, {
      iv: Buffer.from(record.verifyIv),
      ciphertext: Buffer.from(record.verifyCiphertext),
      authTag: Buffer.from(record.verifyAuthTag)
    });

    if (!verifyResult || verifyResult.toString('utf8') !== VERIFY_PLAINTEXT) {
      key.fill(0);
      this.backoff.recordFailure();
      await this.padDelay(started);
      throw new UnauthorizedException({
        code: VAULT_ERRORS.MASTER_INVALID,
        message: '마스터가 일치하지 않습니다.'
      });
    }

    this.session.setKey(key);
    this.backoff.reset();
    await this.padDelay(started);

    // KDF 버전이 다르면 다음 setup-update 단계에서 재암호화 트리거로 활용 가능하나, 현재는 노출만.
  }

  async lock(): Promise<void> {
    if (this.session.isLocking()) {
      throw new HttpException(
        { code: VAULT_ERRORS.VAULT_LOCKING, message: '잠금 처리 중입니다.' },
        423
      );
    }
    await this.session.lock();
  }

  async listEntries(query: { category?: VaultCategory; q?: string }): Promise<EntryView[]> {
    const key = this.requireKey();
    const entries = await this.prisma.vaultEntry.findMany({
      where: {
        category: query.category ?? undefined,
        label: query.q ? { contains: query.q } : undefined
      },
      orderBy: { updatedAt: 'desc' }
    });

    return entries.map((entry) => {
      const payload = this.crypto.openJson<Record<string, unknown>>(key, {
        iv: Buffer.from(entry.iv),
        ciphertext: Buffer.from(entry.ciphertext),
        authTag: Buffer.from(entry.authTag)
      });
      if (!payload) {
        throw new InternalServerErrorException({
          code: 'AEAD_FAILED',
          message: '복호화에 실패했습니다.'
        });
      }
      return {
        id: entry.id,
        category: entry.category as VaultCategory,
        label: entry.label,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        payload
      };
    });
  }

  async findEntry(id: string): Promise<EntryView> {
    const key = this.requireKey();
    const entry = await this.prisma.vaultEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('해당 항목을 찾을 수 없습니다.');

    const payload = this.crypto.openJson<Record<string, unknown>>(key, {
      iv: Buffer.from(entry.iv),
      ciphertext: Buffer.from(entry.ciphertext),
      authTag: Buffer.from(entry.authTag)
    });
    if (!payload) {
      throw new InternalServerErrorException({ code: 'AEAD_FAILED', message: '복호화에 실패했습니다.' });
    }

    return {
      id: entry.id,
      category: entry.category as VaultCategory,
      label: entry.label,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      payload
    };
  }

  async createEntry(dto: CategoryPayloadDto): Promise<EntryView> {
    const key = this.requireKey();
    const normalizedLabel = dto.label.normalize('NFKC').trim();
    if (!normalizedLabel) {
      throw new BadRequestException({ code: VAULT_ERRORS.VALIDATION_FAILED, message: 'label 이 비어 있습니다.' });
    }

    const existing = await this.prisma.vaultEntry.findUnique({
      where: { category_label: { category: dto.category, label: normalizedLabel } }
    });
    if (existing) {
      throw new ConflictException({
        code: VAULT_ERRORS.CATEGORY_LABEL_CONFLICT,
        message: '같은 카테고리와 라벨을 가진 항목이 이미 있습니다.'
      });
    }

    const payload = this.toPayload(dto, normalizedLabel);
    const sealed = this.crypto.sealJson(key, payload);

    const created = await this.prisma.vaultEntry.create({
      data: {
        category: dto.category,
        label: normalizedLabel,
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
        authTag: sealed.authTag,
        kdfVersion: KDF_V1.version
      }
    });

    return this.entryView(created.id, dto.category, normalizedLabel, payload, created.createdAt, created.updatedAt);
  }

  async updateEntry(id: string, dto: CategoryPayloadDto): Promise<EntryView> {
    const key = this.requireKey();
    const existing = await this.prisma.vaultEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('해당 항목을 찾을 수 없습니다.');

    const normalizedLabel = dto.label.normalize('NFKC').trim();
    if (!normalizedLabel) {
      throw new BadRequestException({ code: VAULT_ERRORS.VALIDATION_FAILED, message: 'label 이 비어 있습니다.' });
    }

    if (existing.category !== dto.category || existing.label !== normalizedLabel) {
      const conflict = await this.prisma.vaultEntry.findUnique({
        where: { category_label: { category: dto.category, label: normalizedLabel } }
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException({
          code: VAULT_ERRORS.CATEGORY_LABEL_CONFLICT,
          message: '같은 카테고리와 라벨을 가진 항목이 이미 있습니다.'
        });
      }
    }

    const payload = this.toPayload(dto, normalizedLabel);
    const sealed = this.crypto.sealJson(key, payload);

    const updated = await this.prisma.vaultEntry.update({
      where: { id },
      data: {
        category: dto.category,
        label: normalizedLabel,
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
        authTag: sealed.authTag,
        kdfVersion: KDF_V1.version
      }
    });

    return this.entryView(updated.id, dto.category, normalizedLabel, payload, updated.createdAt, updated.updatedAt);
  }

  // 마스터 또는 KDF 파라미터 변경 시 모든 entry 를 새 키로 재암호화한다.
  // 단일 트랜잭션 안에서 검증·복호화·재암호화·VaultMaster 갱신을 끝내고 새 세션 키를 발행한다.
  async rekey(
    rawCurrentMaster: string,
    rawNewMaster?: string,
    newKdfVersion?: number
  ): Promise<{ rotated: number; kdfVersion: number }> {
    this.requireKey();

    const currentMaster = normalizeMaster(rawCurrentMaster);
    const targetMaster = rawNewMaster !== undefined ? normalizeMaster(rawNewMaster) : currentMaster;

    if (targetMaster.length < 8) {
      throw new BadRequestException({
        code: VAULT_ERRORS.VALIDATION_FAILED,
        message: '정규화 후 새 마스터가 8자 미만입니다.'
      });
    }

    const master = await this.prisma.vaultMaster.findUnique({ where: { id: 'singleton' } });
    if (!master) {
      throw new ServiceUnavailableException('마스터가 설정되지 않았습니다.');
    }

    const currentKey = await this.crypto.deriveKey(currentMaster, Buffer.from(master.salt), {
      version: master.kdfVersion,
      algorithm: 'argon2id',
      memoryKiB: master.kdfMemoryKiB,
      iterations: master.kdfIterations,
      parallelism: master.kdfParallelism,
      saltLength: master.salt.length
    });
    const verifyResult = this.crypto.open(currentKey, {
      iv: Buffer.from(master.verifyIv),
      ciphertext: Buffer.from(master.verifyCiphertext),
      authTag: Buffer.from(master.verifyAuthTag)
    });
    if (!verifyResult || verifyResult.toString('utf8') !== VERIFY_PLAINTEXT) {
      currentKey.fill(0);
      throw new UnauthorizedException({
        code: VAULT_ERRORS.MASTER_INVALID,
        message: '마스터가 일치하지 않습니다.'
      });
    }

    const newKdfVersionValue = newKdfVersion ?? KDF_V1.version;
    const newSalt = this.crypto.generateSalt();
    const newKey = await this.crypto.deriveKey(targetMaster, newSalt);
    const newVerify = this.crypto.seal(newKey, Buffer.from(VERIFY_PLAINTEXT, 'utf8'));

    let rotated = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        const entries = await tx.vaultEntry.findMany();
        for (const entry of entries) {
          const body = this.crypto.openJson<Record<string, unknown>>(currentKey, {
            iv: Buffer.from(entry.iv),
            ciphertext: Buffer.from(entry.ciphertext),
            authTag: Buffer.from(entry.authTag)
          });
          if (!body) {
            throw new InternalServerErrorException({ code: 'AEAD_FAILED', message: '복호화에 실패했습니다.' });
          }
          const sealed = this.crypto.sealJson(newKey, body);
          await tx.vaultEntry.update({
            where: { id: entry.id },
            data: {
              iv: sealed.iv,
              ciphertext: sealed.ciphertext,
              authTag: sealed.authTag,
              kdfVersion: newKdfVersionValue
            }
          });
          rotated += 1;
        }

        await tx.vaultMaster.update({
          where: { id: 'singleton' },
          data: {
            kdfVersion: newKdfVersionValue,
            kdfAlgorithm: KDF_V1.algorithm,
            kdfMemoryKiB: KDF_V1.memoryKiB,
            kdfIterations: KDF_V1.iterations,
            kdfParallelism: KDF_V1.parallelism,
            salt: newSalt,
            verifyIv: newVerify.iv,
            verifyCiphertext: newVerify.ciphertext,
            verifyAuthTag: newVerify.authTag
          }
        });
      });
    } finally {
      currentKey.fill(0);
    }

    this.session.setKey(newKey);

    return { rotated, kdfVersion: newKdfVersionValue };
  }

  async deleteEntry(id: string): Promise<void> {
    this.requireKey();
    const existing = await this.prisma.vaultEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('해당 항목을 찾을 수 없습니다.');
    await this.prisma.vaultEntry.delete({ where: { id } });
  }

  async exportAll(): Promise<Buffer> {
    const key = this.requireKey();
    const master = await this.prisma.vaultMaster.findUnique({ where: { id: 'singleton' } });
    if (!master) {
      throw new ServiceUnavailableException('마스터가 설정되지 않았습니다.');
    }

    const entries = await this.prisma.vaultEntry.findMany({ orderBy: { createdAt: 'asc' } });
    const payload: ExportPayload = {
      entries: entries.map((entry) => {
        const body = this.crypto.openJson<Record<string, unknown>>(key, {
          iv: Buffer.from(entry.iv),
          ciphertext: Buffer.from(entry.ciphertext),
          authTag: Buffer.from(entry.authTag)
        });
        if (!body) {
          throw new InternalServerErrorException({ code: 'AEAD_FAILED', message: '복호화에 실패했습니다.' });
        }
        return { category: entry.category as VaultCategory, label: entry.label, body };
      })
    };

    const sealed = this.crypto.sealJson(key, payload);

    const container: ExportContainer = {
      magic: EXPORT_MAGIC,
      version: EXPORT_VERSION,
      kdf: {
        version: master.kdfVersion,
        algorithm: master.kdfAlgorithm,
        memoryKiB: master.kdfMemoryKiB,
        iterations: master.kdfIterations,
        parallelism: master.kdfParallelism,
        salt: Buffer.from(master.salt).toString('base64')
      },
      payload: {
        iv: sealed.iv.toString('base64'),
        ciphertext: sealed.ciphertext.toString('base64'),
        authTag: sealed.authTag.toString('base64')
      }
    };

    return Buffer.from(JSON.stringify(container), 'utf8');
  }

  async importContainer(
    containerBuf: Buffer,
    rawMaster: string,
    mode: ImportMode = 'reject'
  ): Promise<{ imported: number; skipped: number; replaced: number }> {
    this.requireKey();

    let container: ExportContainer;
    try {
      container = JSON.parse(containerBuf.toString('utf8')) as ExportContainer;
    } catch {
      throw new BadRequestException({ code: VAULT_ERRORS.IMPORT_CORRUPT, message: 'export 파일을 해석할 수 없습니다.' });
    }

    if (container?.magic !== EXPORT_MAGIC || typeof container.version !== 'number') {
      throw new BadRequestException({ code: VAULT_ERRORS.IMPORT_CORRUPT, message: '컨테이너 매직/버전이 잘못되었습니다.' });
    }

    const salt = Buffer.from(container.kdf.salt, 'base64');
    const importKey = await this.crypto.deriveKey(normalizeMaster(rawMaster), salt, {
      version: container.kdf.version,
      algorithm: 'argon2id',
      memoryKiB: container.kdf.memoryKiB,
      iterations: container.kdf.iterations,
      parallelism: container.kdf.parallelism,
      saltLength: salt.length
    });

    const decoded = this.crypto.openJson<ExportPayload>(importKey, {
      iv: Buffer.from(container.payload.iv, 'base64'),
      ciphertext: Buffer.from(container.payload.ciphertext, 'base64'),
      authTag: Buffer.from(container.payload.authTag, 'base64')
    });
    importKey.fill(0);

    if (!decoded || !Array.isArray(decoded.entries)) {
      throw new BadRequestException({ code: VAULT_ERRORS.IMPORT_CORRUPT, message: '복호화에 실패했습니다.' });
    }

    const sessionKey = this.requireKey();

    return this.prisma.$transaction(async (tx) => {
      let imported = 0;
      let skipped = 0;
      let replaced = 0;

      for (const item of decoded.entries) {
        const normalizedLabel = item.label.normalize('NFKC').trim();
        const existing = await tx.vaultEntry.findUnique({
          where: { category_label: { category: item.category, label: normalizedLabel } }
        });

        if (existing) {
          if (mode === 'replace') {
            const sealed = this.crypto.sealJson(sessionKey, item.body);
            await tx.vaultEntry.update({
              where: { id: existing.id },
              data: {
                iv: sealed.iv,
                ciphertext: sealed.ciphertext,
                authTag: sealed.authTag,
                kdfVersion: KDF_V1.version
              }
            });
            replaced += 1;
          } else if (mode === 'skip') {
            skipped += 1;
          } else {
            throw new ConflictException({
              code: VAULT_ERRORS.CATEGORY_LABEL_CONFLICT,
              message: `${item.category} / ${normalizedLabel} 가 이미 존재합니다. mode=replace 로 덮어쓰거나 mode=skip 으로 건너뛸 수 있습니다.`
            });
          }
        } else {
          const sealed = this.crypto.sealJson(sessionKey, item.body);
          await tx.vaultEntry.create({
            data: {
              category: item.category,
              label: normalizedLabel,
              iv: sealed.iv,
              ciphertext: sealed.ciphertext,
              authTag: sealed.authTag,
              kdfVersion: KDF_V1.version
            }
          });
          imported += 1;
        }
      }

      return { imported, skipped, replaced };
    });
  }

  private requireKey(): Buffer {
    const key = this.session.getKey();
    if (!key) {
      throw new UnauthorizedException({ code: VAULT_ERRORS.VAULT_LOCKED, message: 'vault 가 잠겨 있습니다.' });
    }
    return key;
  }

  private toPayload(dto: CategoryPayloadDto, label: string): Record<string, unknown> {
    const { category: _category, label: _label, ...rest } = dto;
    const cleaned: Record<string, unknown> = { label };
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      cleaned[k] = v;
    }
    return cleaned;
  }

  private entryView(
    id: string,
    category: VaultCategory,
    label: string,
    payload: Record<string, unknown>,
    createdAt: Date,
    updatedAt: Date
  ): EntryView {
    return {
      id,
      category,
      label,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      payload
    };
  }

  // unlock 응답 총 소요를 MIN_UNLOCK_DURATION_MS 이상으로 패딩한다.
  // Argon2id 자체가 입력 의존 시간 변동이 적지만, 마스터 미설정/실패/성공 분기의 시간 차이를 일정하게 가린다.
  private async padDelay(startedAt: number): Promise<void> {
    const elapsed = Date.now() - startedAt;
    const remaining = MIN_UNLOCK_DURATION_MS - elapsed;
    if (remaining > 0) await delay(remaining);
  }
}

