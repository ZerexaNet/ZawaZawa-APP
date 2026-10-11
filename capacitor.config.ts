import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zerexa.zawazawa',
  appName: 'ZawaZawa',
  // 用 electron 模式构建（VITE_API_BASE 绝对地址，移动端不能走相对路径）
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
