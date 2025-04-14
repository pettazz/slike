/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import dotenv from 'dotenv';
import react from '@vitejs/plugin-react-swc'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config https://vitest.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SLIKE_');
  if (mode === "development" && !env.SLIKE_LOCAL_API_URL) {
    throw new Error(`SLIKE_LOCAL_API_URL is not defined <${mode}> ${JSON.stringify(env)}`);
  }

  return {
    server: {
      proxy: {
        '/forecast': env.SLIKE_LOCAL_API_URL,
        '/profiles': env.SLIKE_LOCAL_API_URL
      },
    },
    plugins: [react(), tsconfigPaths()],
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: '.vitest/setup',
      include: ['**/test.{ts,tsx}']
    }
  };
})
