import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/program.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [],
  noExternal: [
    'commander',
    'chalk',
    'ora',
    '@clack/prompts',
    'zod',
    'env-paths',
    'simple-git',
    'fast-glob',
    'ignore',
    'minisearch',
  ],
});