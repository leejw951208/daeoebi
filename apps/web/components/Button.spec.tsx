// Button 컴포넌트 테스트(RTL). jest-dom 매처 없이 순수 DOM 단언으로 검증한다.
import { render, screen, fireEvent } from "@testing-library/react"
import { createRef } from "react"
import { Button } from "./Button"

describe("Button", () => {
    it("variant 에 따라 클래스를 매핑한다", () => {
        const { rerender } = render(<Button>확인</Button>)
        expect(screen.getByRole("button").className).toContain("btn")

        rerender(<Button variant="secondary">확인</Button>)
        expect(screen.getByRole("button").className).toContain("secondary")

        rerender(<Button variant="danger">확인</Button>)
        expect(screen.getByRole("button").className).toContain("danger")

        rerender(<Button variant="text">확인</Button>)
        expect(screen.getByRole("button").className).toContain("btn-text")
    })

    it("className 을 base 뒤에 덧붙인다", () => {
        render(<Button className="w-full">확인</Button>)
        const cls = screen.getByRole("button").className
        expect(cls).toContain("btn")
        expect(cls).toContain("w-full")
    })

    it("loading 이면 비활성화하고 aria-busy 를 켜며 스피너를 표시한다", () => {
        const { container } = render(<Button loading>저장</Button>)
        const btn = screen.getByRole("button")
        expect(btn.hasAttribute("disabled")).toBe(true)
        expect(btn.getAttribute("aria-busy")).toBe("true")
        expect(container.querySelector(".btn-spinner")).not.toBeNull()
    })

    it("onClick 을 호출한다", () => {
        const onClick = jest.fn()
        render(<Button onClick={onClick}>클릭</Button>)
        fireEvent.click(screen.getByRole("button"))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("loading 이면 클릭이 막힌다", () => {
        const onClick = jest.fn()
        render(
            <Button loading onClick={onClick}>
                클릭
            </Button>,
        )
        fireEvent.click(screen.getByRole("button"))
        expect(onClick).not.toHaveBeenCalled()
    })

    it("ref 를 버튼 엘리먼트로 전달한다", () => {
        const ref = createRef<HTMLButtonElement>()
        render(<Button ref={ref}>포커스</Button>)
        expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it("기본 type 은 button 이다", () => {
        render(<Button>확인</Button>)
        expect(screen.getByRole("button").getAttribute("type")).toBe("button")
    })
})
