# ZawaZawa 全平台客户端

ZawaZawa（zawa.uk）的全平台客户端。React 19 + TypeScript + Vite，桌面端基于 Electron，移动端基于 Capacitor，与官方站点同后端（`www.zawa.uk` API）。

## 发布平台（GitHub Actions 自动构建）

| 平台 | 产物 | 说明 |
|---|---|---|
| Windows | portable exe | 免安装直接运行 |
| macOS | dmg / zip（Universal） | 未签名，首启右键→打开 |
| Linux | AppImage / deb | |
| Android | APK / AAB | 当前 debug 签名（可安装，不可上架 Play） |
| iOS | — | 需 Apple 开发者账号 + 证书/描述文件，暂未接入 |

推 `main` → 更新 `dev` 预发布；打 `v*.*.*` tag → 正式 release（版本号跟随 tag）。

## 功能

- **视频**：播放（多 CDN 容灾）、弹幕（发送/开关/密度/透明度）、点赞/投币/收藏/困惑/举报、AI 字幕、字幕上传（vtt/srt/ass）、弹幕导入导出（XML）
- **投稿**：本地视频上传 + B 站链接快速导入
- **社区**：关注/粉丝、私信、站内信、工单、公告、社区公投、何意味榜、热门榜、专栏（Markdown）
- **账号**：统一登录（用户名/邮箱 + 密码 + 极验 v4 人机验证）、邮箱验证/换绑、密码找回、账号注销、GDPR 数据导出
- **会员**：粉V 会员（支付宝当面付，发票）、资质认证（粉/黄/蓝标）
- **管理后台**：审核队列、举报处理、评论审核、认证审核、工单、用户管理、视频管理（含地区屏蔽 geo_block 开关）、公告、公投、消息推送
- **主题**：明/暗两套 × 三种界面风格（官网默认 / Win8 磁贴 / Material 3），顶栏一键切换并持久化
- **地区屏蔽**：后端对 `geo_block: CN` 的视频返回 HTTP 451，客户端显示专属"地区限制"提示页

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
```

> 国内网络构建 Electron 时需配置镜像：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`

## 目录结构

```
src/
  api.ts            # REST 客户端（全部端点 + ApiError 状态码）
  types.ts          # 后端 DTO 类型
  store.ts          # 全局状态（用户/主题/Toast）
  icons.tsx         # 线性 SVG 图标库
  captcha.tsx       # 极验 v4 float 封装
  Player.tsx        # 视频播放器（弹幕层 + 多 CDN 切换 + 10s 无数据超时）
  components.tsx    # 顶栏/底栏/卡片/评论/弹窗等公共组件
  lib/utils.ts      # CDN 容灾链（R2/S3）、封面回退、工具函数
  lib/danmaku.ts    # 弹幕引擎
  lib/markdown.ts   # Markdown 渲染（含安全白名单）
  pages/            # 各路由页面
electron/main.cjs   # Electron 主进程（窗口 + 应用内更新检查）
```

## 媒体容灾策略

- **视频流**：接口主地址 → R2（bsbucket/bucket/eobucket.video.hkmc.online，ESA 阿里云 CDN 边缘）→ 雨云 S3（上海 → 港澳 → 悉尼）。任一档出错或 10 秒无数据自动切下一档
- **封面**：R2 直链优先（key 与 S3 相同：`covers/<id>/<file>`），逐档回退至后端代理 `/api/s3/object`
- **地区屏蔽**：播放地址不可达 ≠ 地区屏蔽。451 由后端按访问者 IP 判定，客户端展示专属提示，不走容灾
