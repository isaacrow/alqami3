import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: './',
  plugins: [
    basicSsl()
  ],
  server: {
    host: true,
    port: 3000,
    open: false,
    cors: true,
    https: true
  },
  optimizeDeps: {
    include: ['three', 'n3']
  },
  build: {
    target: 'esnext'
  }
});
