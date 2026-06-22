// vault HTTP 엔드포인트. setup/unlock/lock/status, entries CRUD, export/import 를 노출한다.
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
    Res,
} from "@nestjs/common"
import type { Response } from "express"
import { VaultService } from "./vault.service"
import { MasterDto } from "./dto/master.dto"
import {
    CategoryPayloadDto,
    CreateEntryDto,
    UpdateEntryDto,
} from "./dto/category-payload.dto"
import { ListEntriesQueryDto } from "./dto/list-entries.dto"
import { ImportQueryDto } from "./dto/import-query.dto"
import { ImportBodyDto } from "./dto/import-body.dto"
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

    @Get("entries")
    listEntries(@Query() query: ListEntriesQueryDto) {
        return this.service.listEntries(query)
    }

    @Post("entries")
    @HttpCode(201)
    createEntry(@Body() dto: CreateEntryDto) {
        return this.service.createEntry(dto as CategoryPayloadDto)
    }

    @Get("entries/:id")
    findEntry(@Param("id") id: string) {
        return this.service.findEntry(id)
    }

    @Patch("entries/:id")
    updateEntry(@Param("id") id: string, @Body() dto: UpdateEntryDto) {
        return this.service.updateEntry(id, dto as CategoryPayloadDto)
    }

    @Delete("entries/:id")
    @HttpCode(200)
    async deleteEntry(@Param("id") id: string): Promise<{ ok: true }> {
        await this.service.deleteEntry(id)
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

    @Post("export")
    @HttpCode(200)
    async export(@Res() res: Response): Promise<void> {
        const buf = await this.service.exportAll()
        res.setHeader("Content-Type", "application/octet-stream")
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="secrets-manager-vault.lkvault"',
        )
        res.send(buf)
    }

    @Post("import")
    @HttpCode(200)
    async import(@Body() body: ImportBodyDto, @Query() query: ImportQueryDto) {
        const containerBuf = Buffer.from(body.container, "base64")
        return this.service.importContainer(
            containerBuf,
            body.master,
            query.mode ?? "reject",
        )
    }
}
