// SavingsAccountService 단위 테스트(Prisma 모킹). list/create/update(부분 필드)/remove·base64url 패스스루를 검증한다.
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { SavingsAccountService } from "./savings-account.service"
import { toBase64url } from "../common/base64url"
import { ASSET_ERRORS } from "./asset.types"

function makePrisma() {
    return {
        savingsAccount: {
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    }
}
function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new SavingsAccountService(prisma as unknown as never)
}

const IV = Buffer.alloc(12, 1)
const CT = Buffer.alloc(48, 2)
const TAG = Buffer.alloc(16, 3)
const B = {
    iv: IV.toString("base64url"),
    ciphertext: CT.toString("base64url"),
    authTag: TAG.toString("base64url"),
}

describe("SavingsAccountService", () => {
    it("list 는 생성일 오름차순으로 전부 조회해 블롭을 base64url 로 반환한다", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.findMany.mockResolvedValue([
            {
                id: "a1",
                name: "청년도약계좌",
                color: "#20a4a4",
                iv: IV,
                ciphertext: CT,
                authTag: TAG,
            },
        ])
        const out = await makeService(prisma).list()
        expect(prisma.savingsAccount.findMany.mock.calls[0][0]).toMatchObject({
            orderBy: { createdAt: "asc" },
        })
        expect(out[0]).toMatchObject({
            id: "a1",
            name: "청년도약계좌",
            color: "#20a4a4",
            iv: toBase64url(IV),
        })
    })

    it("create 는 name·color 와 디코드한 바이트를 저장한다", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.create.mockResolvedValue({
            id: "a9",
            name: "청년도약계좌",
            color: "#20a4a4",
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma).create({
            name: "청년도약계좌",
            color: "#20a4a4",
            ...B,
        } as never)
        const arg = prisma.savingsAccount.create.mock.calls[0][0]
        expect(arg.data.name).toBe("청년도약계좌")
        expect(arg.data.color).toBe("#20a4a4")
        expect(Buffer.from(arg.data.iv)).toEqual(IV)
    })

    it("update 는 color 만 보내면 색만 갱신한다(암호문 없이도 허용)", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.update.mockResolvedValue({
            id: "a1",
            name: "청년도약계좌",
            color: "#7b61ff",
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma).update("a1", { color: "#7b61ff" } as never)
        const arg = prisma.savingsAccount.update.mock.calls[0][0]
        expect(arg.where).toEqual({ id: "a1" })
        expect(arg.data).toMatchObject({ color: "#7b61ff" })
        expect(arg.data.iv).toBeUndefined()
    })

    it("update 는 세 필드를 모두 보내면 암호문도 함께 갱신한다", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.update.mockResolvedValue({
            id: "a1",
            name: "청년도약계좌",
            color: "#20a4a4",
            iv: IV,
            ciphertext: CT,
            authTag: TAG,
        })
        await makeService(prisma).update("a1", B as never)
        const arg = prisma.savingsAccount.update.mock.calls[0][0]
        expect(Buffer.from(arg.data.iv)).toEqual(IV)
        expect(Buffer.from(arg.data.ciphertext)).toEqual(CT)
        expect(Buffer.from(arg.data.authTag)).toEqual(TAG)
    })

    it("update 는 암호문 필드 중 일부만 보내면 거부한다", async () => {
        const prisma = makePrisma()
        await expect(
            makeService(prisma).update("a1", { iv: B.iv } as never),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.CIPHERTEXT_INCOMPLETE_ASSET },
        })
    })

    it("update 는 존재하지 않으면 SAVINGS_ACCOUNT_NOT_FOUND(update 가 P2025 로 거부)", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.update.mockRejectedValue({ code: "P2025" })
        await expect(
            makeService(prisma).update("nope", { color: "#20a4a4" } as never),
        ).rejects.toMatchObject({
            response: { code: ASSET_ERRORS.SAVINGS_ACCOUNT_NOT_FOUND },
        })
    })

    it("remove 는 없는 id 면 NotFound 를 던진다(delete 가 P2025 로 거부)", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.delete.mockRejectedValue({ code: "P2025" })
        await expect(makeService(prisma).remove("nope")).rejects.toThrow(
            NotFoundException,
        )
    })

    it("remove 는 존재하면 delete 를 호출한다", async () => {
        const prisma = makePrisma()
        prisma.savingsAccount.delete.mockResolvedValue({ id: "a1" })
        await makeService(prisma).remove("a1")
        expect(prisma.savingsAccount.delete).toHaveBeenCalledWith({
            where: { id: "a1" },
        })
    })
})

describe("SavingsAccountService BadRequestException 타입", () => {
    it("암호문 불완전 오류는 BadRequestException 이다", async () => {
        const prisma = makePrisma()
        await expect(
            makeService(prisma).update("a1", {
                ciphertext: B.ciphertext,
            } as never),
        ).rejects.toThrow(BadRequestException)
    })
})
