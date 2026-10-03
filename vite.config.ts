import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 設定頁顯示的版本代號，用來確認手機上跑的是不是最新一版（對照 GitHub 的 commit）
function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.AWS_COMMIT_ID?.slice(0, 7) ?? gitSha();
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(`${sha}，${buildDate}`),
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
  },
});
