import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['sim/test/**/*.test.ts', 'tools/test/**/*.test.ts', 'web/test/**/*.test.ts'], testTimeout: 60000 } });
