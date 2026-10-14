import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: [
    { command: 'npm run dev', cwd: '../api', url: 'http://localhost:3000/health', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI }
  ]
});
