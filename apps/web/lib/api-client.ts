// 백엔드 API 호출을 캡슐화한다. axios 인스턴스와 도메인 helper 함수를 한 곳에 모은다.
import axios, { AxiosError, AxiosInstance } from "axios"
import { ApiError } from "./api-error"
import type {
    CreateExpenseInput,
    ExpenseOccurrence,
    RecurringExpense,
    SummaryResponse,
    UpdateExpenseInput,
    UpdateOccurrenceInput,
} from "./types"

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000"

export const apiClient: AxiosInstance = axios.create({
    baseURL,
    timeout: 10_000,
})

apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => Promise.reject(ApiError.fromAxios(error)),
)

export async function getExpenses(): Promise<RecurringExpense[]> {
    const { data } = await apiClient.get<RecurringExpense[]>("/expenses")
    return data
}

export async function getExpense(id: string): Promise<RecurringExpense> {
    const { data } = await apiClient.get<RecurringExpense>(`/expenses/${id}`)
    return data
}

export async function createExpense(
    input: CreateExpenseInput,
): Promise<RecurringExpense> {
    const { data } = await apiClient.post<RecurringExpense>("/expenses", input)
    return data
}

export async function updateExpense(
    id: string,
    input: UpdateExpenseInput,
): Promise<RecurringExpense> {
    const { data } = await apiClient.patch<RecurringExpense>(
        `/expenses/${id}`,
        input,
    )
    return data
}

export async function deleteExpense(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}`)
}

export interface ListOccurrencesParams {
    from?: string
    to?: string
    status?: string
    category?: string
    paymentMethod?: string
}

export async function getOccurrences(
    params: ListOccurrencesParams = {},
): Promise<ExpenseOccurrence[]> {
    const { data } = await apiClient.get<ExpenseOccurrence[]>("/occurrences", {
        params,
    })
    return data
}

export async function updateOccurrence(
    id: string,
    input: UpdateOccurrenceInput,
): Promise<ExpenseOccurrence> {
    const { data } = await apiClient.patch<ExpenseOccurrence>(
        `/occurrences/${id}`,
        input,
    )
    return data
}

export async function getSummary(
    from: string,
    to: string,
): Promise<SummaryResponse> {
    const { data } = await apiClient.get<SummaryResponse>("/summary", {
        params: { from, to },
    })
    return data
}

export function buildCsvDownloadUrl(from: string, to: string): string {
    return `${baseURL}/export/csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
}
