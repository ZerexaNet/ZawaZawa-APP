# ZawaZawa 全平台客户端

ZawaZawa（zawa.uk）的全平台客户端。React 19 + TypeScript + Vite，桌面端基于 Electron，移动端基于 Capacitor，Web 端为可安装的 PWA，与官方站点同后端（`www.zawa.uk` API）。

## 发布平台（GitHub Actions 自动构建）

| 平台 | 产物 | 说明 |
|---|---|---|
| Windows | portable exe | 免安装直接运行 |
| macOS | dmg / zip（Universal） | 未签名，首启右键→打开 |
| Linux | AppImage / deb | |
| Android | APK / AAB | 当前 debug 签名（可安装，不可上架 Play） |
| Web | PWA | manifest + Service Worker，可安装到桌面/主屏 |
| iOS | — | 需 Apple 开发者账号 + 证书/描述文件，暂未接入 |

推 `main` → 更新 `dev` 预发布；打 `v*.*.*` tag → 正式 release（版本号跟随 tag）。

## 功能

- **视频**：播放（多 CDN 容灾）、canvas 弹幕引擎（发送/密度/透明度/XML 导入导出/点击跳转）、VTT/SRT/ASS 字幕 + AI 字幕生成、倍速/PiP/全屏/快捷键、点赞/投币/收藏/困惑/举报、不感兴趣、观看历史（进度恢复）、地区屏蔽（451）专属提示页
- **投稿**：SHA-256 秒传检测 + 分片上传（10MB × 4 并发、重试、直传/代理回退）、封面自动截取（canvas@20s）或手动上传、B 站等外链快速导入
- **社区**：关注/粉丝/互关、私信、通知、评论（楼中楼 + 机器翻译）、专栏（Markdown）、动态（9 图）、合集、社区公投（投票/结果/CSV）、何意味榜（日/周/月/年）、热门榜、工单
- **账号**：统一登录（用户名/邮箱 + 密码 + Geetest v4 + Turnstile 双验证）、邮箱验证、密码找回、账号注销（邮箱码确认）、GDPR 数据导出
- **会员**：粉V 会员（Stripe / 微信 / 支付宝 checkout，pending 确认/取消、Portal）
- **认证**：实名认证材料提交（黄V/蓝V）
- **管理后台**：审核队列、举报处理、评论审核、认证审核、工单、用户管理（含拉黑/权限）、视频管理（含 geo_block）、公告、公投、消息推送 —— 按角色自动过滤
- **主题**：单一 Google Material 3 + Liquid Glass 主题（暗色紫罗兰 token 体系；`backdrop-filter` 仅 5 处表面，列表卡片 glass-lite 零模糊开销，性能优先）

## 构建

```bash
npm install

# 桌面端（electron 模式，VITE_API_BASE 来自 .env.electron）
npm run build:web
npx electron-builder --win --x64      # Windows portable
npx electron-builder --linux AppImage deb   # Linux
npx electron-builder --mac            # macOS（未签名需 CSC_IDENTITY_AUTO_DISCOVERY=false）

# Android
npm run build:web
npx cap sync android
cd android && ./gradlew assembleRelease bundleRelease
# 产物: android/app/build/outputs/apk/release/app-release.apk, outputs/bundle/release/app-release.aab

# Web（PWA）
npm run build   # 产物 dist/，任意静态托管；/api 需同源或反代到 www.zawa.uk
```

> 国内网络构建 Electron 时需配置镜像：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`

## 目录结构

```
src/
  main.tsx          # 入口（SW 注册）
  App.tsx           # 路由（Web BrowserRouter / Electron file:// 自动切 HashRouter）
  api.ts            # REST 客户端（135+ 端点 + ApiError 状态码）
  types.ts          # 后端 DTO 类型
  store/            # 全局状态（auth / toast / UI）
  components/       # Shell（顶栏/底栏）、Player（弹幕+字幕）、UI 组件
  lib/              # 工具、CDN 容灾链、弹幕引擎、Markdown、分类树
  pages/            # 28 个路由页面（懒加载）
public/             # PWA manifest / sw.js / 图标
electron/main.cjs   # Electron 主进程（窗口 + 应用内更新检查）
android/            # Capacitor Android 壳
.github/workflows/  # CI：tag→正式 release，无 tag→dev 预发布
```

## 媒体容灾策略

- **视频流**：接口主地址 → R2（bsbucket/bucket/eobucket.video.hkmc.online，ESA 阿里云 CDN 边缘）→ 雨云 S3（上海 → 港澳 → 悉尼）。任一档出错或 10 秒无数据自动切下一档
- **封面**：R2 直链优先（key 与 S3 相同：`covers/<id>/<file>`），逐档回退至后端代理 `/api/s3/object`
- **地区屏蔽**：播放地址不可达 ≠ 地区屏蔽。451 由后端按访问者 IP 判定，客户端展示专属提示，不走容灾

## API 参考

`docs/api-reference.md` — 后端 135 个端点的结构化参考（参数/响应/错误码）。
