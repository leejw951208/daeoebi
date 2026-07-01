// CategoryColorInput 테스트(RTL). HEX 입력 정규화·미리보기 스와치·접근성.
import { render, screen, fireEvent } from "@testing-library/react"
import { CategoryColorInput } from "./CategoryColorInput"

describe("CategoryColorInput", () => {
    it("aria-label 과 value 를 노출한다", () => {
        render(<CategoryColorInput value="#123456" onChange={() => {}} />)
        const input = screen.getByLabelText("색상 HEX 코드") as HTMLInputElement
        expect(input.value).toBe("#123456")
        expect(input.getAttribute("maxlength")).toBe("7")
    })

    it("입력값을 정규화해 onChange 로 전달한다(# 보정·소문자)", () => {
        const onChange = jest.fn()
        render(<CategoryColorInput value="" onChange={onChange} />)
        fireEvent.change(screen.getByLabelText("색상 HEX 코드"), {
            target: { value: "F2994A" },
        })
        expect(onChange).toHaveBeenCalledWith("#f2994a")
    })

    it("허용문자 외를 제거해 정규화한다", () => {
        const onChange = jest.fn()
        render(<CategoryColorInput value="" onChange={onChange} />)
        fireEvent.change(screen.getByLabelText("색상 HEX 코드"), {
            target: { value: "#1a 2b zz" },
        })
        expect(onChange).toHaveBeenCalledWith("#1a2b")
    })

    it("미리보기 스와치를 렌더한다", () => {
        const { container } = render(
            <CategoryColorInput value="#f2994a" onChange={() => {}} />,
        )
        expect(
            container.querySelector("span[aria-hidden='true']"),
        ).not.toBeNull()
    })
})
