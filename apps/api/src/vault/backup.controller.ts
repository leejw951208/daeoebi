// 백업 export/import 엔드포인트(/store/*). 전역 세션 가드로 보호된다. 서버는 복호화하지 않는다.
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    Query,
} from "@nestjs/common"
import { BackupService } from "./backup.service"
import { ImportBackupDto, type ImportMode } from "./dto/backup.dto"
import { VAULT_ERRORS } from "./vault.types"

const VALID_MODES: ImportMode[] = ["reject", "skip", "replace"]

@Controller("store")
export class BackupController {
    constructor(private readonly service: BackupService) {}

    @Get("export")
    export() {
        return this.service.export()
    }

    @Post("import")
    @HttpCode(200)
    import(@Body() dto: ImportBackupDto, @Query("mode") mode = "reject") {
        if (!VALID_MODES.includes(mode as ImportMode)) {
            throw new BadRequestException({
                code: VAULT_ERRORS.IMPORT_INVALID,
                message: "mode 는 reject·skip·replace 중 하나여야 합니다.",
            })
        }
        return this.service.import(dto, mode as ImportMode)
    }
}
