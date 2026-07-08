"use client"
// 시크릿 폼 1단계: 편집. 제목(평문)·필드(암호화)·메모를 구성한다.
// 필드 한 행은 SecretFieldRow 가 그리고, 상태는 상위(SecretForm)가 보유한다.
import type { SecretField } from "../../_lib/vault-context"
import { FIELD_SUGGESTIONS } from "../../_lib/field-suggestions"
import { MAX_FIELDS, type FieldRow } from "./types"
import { SecretFieldRow } from "./SecretFieldRow"

interface Props {
    isEditing: boolean
    label: string
    onLabelChange: (value: string) => void
    memo: string
    onMemoChange: (value: string) => void
    rows: FieldRow[]
    usedNames: Set<string>
    hint: string | null
    error: string | null
    submitting: boolean
    onCancel: () => void
    onNext: () => void
    onAddRow: (name?: string) => void
    onUpdateRow: (index: number, patch: Partial<SecretField>) => void
    onMoveRow: (index: number, dir: -1 | 1) => void
    onRemoveRow: (index: number) => void
}

export function SecretEditStep({
    isEditing,
    label,
    onLabelChange,
    memo,
    onMemoChange,
    rows,
    usedNames,
    hint,
    error,
    submitting,
    onCancel,
    onNext,
    onAddRow,
    onUpdateRow,
    onMoveRow,
    onRemoveRow,
}: Props) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
            }}
        >
            <div
                className="sticky-header"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    type="button"
                    className="btn-text"
                    onClick={onCancel}
                    disabled={submitting}
                >
                    취소
                </button>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {isEditing ? "항목 수정" : "새 항목"}
                </div>
                <button
                    type="button"
                    className="btn-text"
                    style={{ color: "var(--ac)", fontWeight: 700 }}
                    onClick={onNext}
                >
                    다음
                </button>
            </div>

            <div
                className="stagger"
                // 프로토타입과 동일하게 flex 컬럼으로 배치한다. grid 암묵적 auto 컬럼은
                // 가장 넓은 자식(가로 스크롤 추천칩 묶음)에 맞춰 늘어나 입력들이 컨테이너를 벗어난다.
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 22,
                    minWidth: 0,
                    marginInline: "calc(-1 * var(--container-padding))",
                    paddingInline: 18,
                    paddingTop: 20,
                    paddingBottom: 70,
                }}
            >
                {hint && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ margin: 0 }}
                    >
                        {hint}
                    </div>
                )}
                {error && (
                    <div
                        role="alert"
                        className="error-box"
                        style={{ margin: 0 }}
                    >
                        {error}
                    </div>
                )}

                <div className="form-row" style={{ margin: 0 }}>
                    <label htmlFor="secret-label" style={{ color: "#a0a0a0" }}>
                        제목{" "}
                        <span
                            style={{
                                color: "#cbcbcb",
                                fontWeight: 600,
                            }}
                        >
                            · 평문 저장
                        </span>
                    </label>
                    <input
                        id="secret-label"
                        type="text"
                        className="field-control"
                        placeholder="예: 국민은행 인터넷뱅킹"
                        value={label}
                        onChange={(e) => onLabelChange(e.target.value)}
                        maxLength={200}
                        autoComplete="off"
                        style={{ fontWeight: 600 }}
                    />
                </div>

                <fieldset
                    style={{
                        border: "none",
                        padding: 0,
                        margin: 0,
                        minWidth: 0,
                    }}
                >
                    <legend
                        style={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 9,
                            padding: 0,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: "#a0a0a0",
                            }}
                        >
                            필드{" "}
                            <span
                                style={{
                                    color: "#cbcbcb",
                                    fontWeight: 600,
                                }}
                            >
                                · 암호화
                            </span>
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#bcbcbc",
                            }}
                        >
                            {rows.length}/{MAX_FIELDS}
                        </span>
                    </legend>

                    {/* 추천 칩 가로 스크롤 (quick-add) */}
                    <div
                        className="scr"
                        style={{
                            display: "flex",
                            gap: 6,
                            overflowX: "auto",
                            minWidth: 0,
                            paddingBottom: 8,
                            marginBottom: 4,
                        }}
                    >
                        <span
                            style={{
                                flexShrink: 0,
                                fontSize: 11,
                                color: "#bbb",
                                alignSelf: "center",
                                fontWeight: 600,
                            }}
                        >
                            추천
                        </span>
                        {FIELD_SUGGESTIONS.map((s) => (
                            <button
                                key={s.name}
                                type="button"
                                onClick={() => onAddRow(s.name)}
                                disabled={
                                    usedNames.has(s.name) ||
                                    rows.length >= MAX_FIELDS
                                }
                                style={{
                                    flexShrink: 0,
                                    border: "1px solid #e8e8e8",
                                    borderRadius: 999,
                                    padding: "6px 12px",
                                    font: "inherit",
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: "#666",
                                    background: "#fff",
                                    cursor:
                                        usedNames.has(s.name) ||
                                        rows.length >= MAX_FIELDS
                                            ? "not-allowed"
                                            : "pointer",
                                    opacity:
                                        usedNames.has(s.name) ||
                                        rows.length >= MAX_FIELDS
                                            ? 0.45
                                            : 1,
                                }}
                            >
                                + {s.name}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "grid", gap: 9 }}>
                        {rows.map((row, idx) => (
                            <SecretFieldRow
                                key={row.key}
                                index={idx}
                                name={row.name}
                                value={row.value}
                                sensitive={row.sensitive ?? false}
                                isFirst={idx === 0}
                                isLast={idx === rows.length - 1}
                                onUpdate={(patch) => onUpdateRow(idx, patch)}
                                onMove={(dir) => onMoveRow(idx, dir)}
                                onRemove={() => onRemoveRow(idx)}
                            />
                        ))}

                        <button
                            type="button"
                            onClick={() => onAddRow()}
                            disabled={rows.length >= MAX_FIELDS}
                            style={{
                                minHeight: 46,
                                border: "1.5px dashed #d8d8d8",
                                borderRadius: 13,
                                background: "none",
                                font: "inherit",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--ac)",
                                cursor:
                                    rows.length >= MAX_FIELDS
                                        ? "not-allowed"
                                        : "pointer",
                                opacity: rows.length >= MAX_FIELDS ? 0.5 : 1,
                            }}
                        >
                            + 필드 추가
                        </button>
                    </div>
                </fieldset>

                <div className="form-row" style={{ margin: 0 }}>
                    <label htmlFor="secret-memo" style={{ color: "#a0a0a0" }}>
                        메모{" "}
                        <span
                            style={{
                                color: "#cbcbcb",
                                fontWeight: 600,
                            }}
                        >
                            · 암호화 · 선택
                        </span>
                    </label>
                    <textarea
                        id="secret-memo"
                        className="field-control"
                        placeholder="선택 입력"
                        value={memo}
                        onChange={(e) => onMemoChange(e.target.value)}
                        rows={3}
                        maxLength={4096}
                        style={{ fontSize: 15, resize: "none" }}
                    />
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 9,
                        alignItems: "flex-start",
                        padding: "13px 14px",
                        borderRadius: 13,
                        background: "var(--soft)",
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{ fontSize: 14, lineHeight: 1.4 }}
                    >
                        🔒
                    </span>
                    <span
                        style={{
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            color: "#666",
                            fontWeight: 500,
                        }}
                    >
                        제목만 평문으로 저장되고, 필드 이름·값·메모는 통째로
                        암호화됩니다.
                    </span>
                </div>
            </div>
        </div>
    )
}
