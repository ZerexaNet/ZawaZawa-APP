import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相对路径资源：兼容 Electron file:// 加载（Web 部署同样可用）
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://www.zawa.uk',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
