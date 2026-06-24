// 라벨 검색 엔드포인트. 전역 세션 가드로 보호된다.
import { Controller, Get, Query } from "@nestjs/common"
import { SearchService } from "./search.service"

@Controller("search")
export class SearchController {
    constructor(private readonly service: SearchService) {}

    @Get()
    search(@Query("q") q = "") {
        return this.service.search(q)
    }
}
