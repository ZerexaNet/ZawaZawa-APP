import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相对路径资源：兼容 Electron file:// 加载（Web 部署同样可用）
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'https://www.zawa.uk', changeOrigin: true, secure: true },
      '/login_api': { target: 'https://www.zawa.uk', changeOrigin: true, secure: true },
      '/register_api': { target: 'https://www.zawa.uk', changeOrigin: true, secure: true },
      '/logout_api': { target: 'https://www.zawa.uk', changeOrigin: true, secure: true },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'react';
            if (/[\\/]node_modules[\\/](marked|dompurify)[\\/]/.test(id)) return 'markdown';
          }
          return undefined;
        },
      },
    },
  },
});
