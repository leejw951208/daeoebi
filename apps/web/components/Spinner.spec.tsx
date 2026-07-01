// Spinner 컴포넌트 테스트(RTL). 순수 DOM 단언.
import { render } from "@testing-library/react"
import { Spinner } from "./Spinner"

describe("Spinner", () => {
    it("기본 크기(16px)와 spinner 클래스를 렌더한다", () => {
        const { container } = render(<Spinner />)
        const el = container.querySelector("span.spinner") as HTMLElement
        expect(el).not.toBeNull()
        expect(el.style.width).toBe("16px")
        expect(el.style.height).toBe("16px")
        expect(el.getAttribute("aria-hidden")).toBe("true")
    })

    it("size 를 px 로 반영한다", () => {
        const { container } = render(<Spinner size={24} />)
        const el = container.querySelector("span.spinner") as HTMLElement
        expect(el.style.width).toBe("24px")
    })

    it("className 을 spinner 뒤에 덧붙인다", () => {
        const { container } = render(<Spinner className="btn-spinner" />)
        const el = container.querySelector("span") as HTMLElement
        expect(el.className).toContain("spinner")
        expect(el.className).toContain("btn-spinner")
    })
})
