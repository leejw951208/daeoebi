// 라벨 검색 엔드포인트. PIN 로그인 보호.
import { Controller, Get, Query, UseGuards } from "@nestjs/common"
import { PinGuard } from "../pin/pin.guard"
import { SearchService } from "./search.service"

@Controller("search")
@UseGuards(PinGuard)
export class SearchController {
    constructor(private readonly service: SearchService) {}

    @Get()
    search(@Query("q") q = "") {
        return this.service.search(q)
    }
}
