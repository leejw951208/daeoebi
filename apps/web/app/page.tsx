// 홈. 비밀번호 금고 단일 제품이므로 보관함으로 리다이렉트한다.
import { redirect } from "next/navigation"

export default function HomePage() {
    redirect("/vault")
}
