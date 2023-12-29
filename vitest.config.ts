/// <reference types="vitest" />

import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [tsconfigPaths(), react()],
	css: { postcss: { plugins: [] } },
	test: {
		include: ['./app/**/*.test.{ts,tsx}'],
		setupFiles: ['./tests/setup/setup-test-env.ts'],
		// add a globalSetup to the ./tests/setup/global-setup.ts file
		globalSetup: ['./tests/setup/global-setup.ts'],
		restoreMocks: true,
		coverage: {
			include: ['app/**/*.{ts,tsx}'],
			all: true,
		},
	},
})
