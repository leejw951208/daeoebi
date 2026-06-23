// vault HTTP 엔드포인트. 마스터 setup/unlock/lock/status 와 rekey 를 노출한다.
// 비밀번호 CRUD 는 StoreModule(/sites·/secrets)이 담당한다.
import { Body, Controller, Get, HttpCode, Post, Res } from "@nestjs/common"
import type { Response } from "express"
import { VaultService } from "./vault.service"
import { MasterDto } from "./dto/master.dto"
import { RekeyDto } from "./dto/rekey.dto"
import { VaultPublic } from "./vault-public.decorator"
import { clearCsrfMarker, issueCsrfMarker } from "./vault-cookies"

@Controller("vault")
export class VaultController {
    constructor(private readonly service: VaultService) {}

    @Get("status")
    @VaultPublic()
    status() {
        return this.service.status()
    }

    @Post("setup")
    @HttpCode(201)
    @VaultPublic()
    async setup(
        @Body() dto: MasterDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ ok: true }> {
        await this.service.setup(dto.master)
        issueCsrfMarker(res)
        return { ok: true }
    }

    @Post("unlock")
    @HttpCode(200)
    @VaultPublic()
    async unlock(
        @Body() dto: MasterDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ ok: true }> {
        await this.service.unlock(dto.master)
        issueCsrfMarker(res)
        return { ok: true }
    }

    @Post("lock")
    @HttpCode(200)
    @VaultPublic()
    async lock(
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ ok: true }> {
        await this.service.lock()
        clearCsrfMarker(res)
        return { ok: true }
    }

    @Post("rekey")
    @HttpCode(200)
    rekey(@Body() dto: RekeyDto) {
        return this.service.rekey(
            dto.currentMaster,
            dto.newMaster,
            dto.newKdfVersion,
        )
    }
}
