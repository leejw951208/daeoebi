import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    retries: 0,
    reporter: "list",
    timeout: 60_000,
    expect: {
        timeout: 15_000,
    },
    use: {
        baseURL: "http://localhost:3010",
        headless: true,
        trace: "on",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
})
