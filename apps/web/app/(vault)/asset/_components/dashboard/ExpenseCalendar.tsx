"use client"
// 자산 대시보드의 지출 달력 카드. 월 그리드에 일별 지출 합계를 축약 표기하고
// 날짜 셀을 누르면 선택일이 바뀐다(상세는 상위 DayDetail 이 그린다).
import { WEEKDAYS, buildCalendar, todayISO } from "../../_lib/asset-dates"

interface Props {
    month: string
    dayTotals: Map<string, number>
    selectedDay: string | null
    onSelectDay: (d: string) => void
    count: number
}

// 달력 셀 금액 축약. 디자인 mock 기준: 만 단위는 1자리 소수(142000→"14.2만"),
// 그 미만은 천 단위로 반올림(8500→"9천").
function abbrev(n: number): string {
    if (n >= 10000)
        return `${(Math.round(n / 1000) / 10).toString().replace(/\.0$/, "")}만`
    return `${Math.round(n / 1000)}천`
}

export function ExpenseCalendar({
    month,
    dayTotals,
    selectedDay,
    onSelectDay,
    count,
}: Props) {
    const cells = buildCalendar(month)
    const today = todayISO()

    return (
        <div
            className="asset-card"
            style={{ padding: "16px 14px 18px", marginTop: 4 }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    padding: "0 4px",
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 800 }}>지출 달력</span>
                <span
                    style={{
                        fontSize: 12,
                        color: "#9a9a9a",
                        fontWeight: 600,
                    }}
                >
                    {count}건
                </span>
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    marginBottom: 6,
                }}
            >
                {WEEKDAYS.map((w, i) => {
                    // 일(0)·토(6)만 요일색으로 구분하고 나머지는 muted 로 둔다.
                    const color =
                        i === 0 ? "#e5484d" : i === 6 ? "#4a90d9" : "#bcbcbc"
                    return (
                        <div
                            key={w}
                            style={{
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color,
                                padding: "4px 0",
                            }}
                        >
                            {w}
                        </div>
                    )
                })}
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 4,
                }}
            >
                {cells.map((cell, i) => {
                    if (cell.day === null)
                        return <div key={`b${i}`} aria-hidden="true" />
                    const amount = dayTotals.get(cell.date!) ?? 0
                    const active = cell.date === selectedDay
                    const isToday = cell.date === today
                    const className =
                        "cal-cell" +
                        (active
                            ? " active"
                            : (amount > 0 ? " has-spend" : "") +
                              (isToday ? " today" : ""))
                    return (
                        <button
                            key={cell.date}
                            type="button"
                            onClick={() => onSelectDay(cell.date!)}
                            aria-pressed={active}
                            className={className}
                        >
                            <span className="cal-day">{cell.day}</span>
                            {amount > 0 && (
                                <span className="cal-amt">
                                    {abbrev(amount)}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
