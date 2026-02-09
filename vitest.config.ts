import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@root': path.resolve(__dirname),
      '@common': path.resolve(__dirname, 'common'),
      '@components': path.resolve(__dirname, 'components'),
      '@system': path.resolve(__dirname, 'system'),
      '@demos': path.resolve(__dirname, 'demos'),
      '@data': path.resolve(__dirname, 'data'),
      '@pages': path.resolve(__dirname, 'pages'),
      '@modules': path.resolve(__dirname, 'modules'),
    },
  },
  test: {
    include: ['**/*.test.ts'],
  },
});
