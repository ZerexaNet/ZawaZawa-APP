# ZawaZawa API Reference (auto-generated)

## 健康检查 — GET /api/ping [auth]
resp: {pong:boolean}

## 客户端登录（无人机验证） — POST /login_api [auth]
body: {username:string; password:string}
body(application/json): {username:string; password:string}
resp: {success:boolean; token:string; user:User}

## 注册账号 — POST /api/auth/register [auth]
body: {username:string; email:string; password:string; turnstileToken:string}
body(application/json): {username:string; email:string; password:string; turnstileToken:string}
resp: {success:boolean; requires_email_verification:boolean; verification_method:string; masked_email:string; expires_at:string}

## 登录 — POST /api/auth/login [auth]
body: {username:string; password:string; turnstileToken:string}
body(application/json): {username:string; password:string; turnstileToken:string}
resp: {success:boolean; token:string; user:User}

## 退出登录 — POST /api/auth/logout [auth]
resp: Success

## 检查用户名是否可用 — GET /api/auth/username-available [auth]
params: username(query!):string exclude_id(query):string
resp: {available:boolean; reason:string}

## 申请注销账号（发送验证邮件） — POST /api/auth/deactivate [auth]
body: {confirmed:boolean; confirmText:string}
body(application/json): {confirmed:boolean; confirmText:string}
resp: {success:boolean; requires_email_verification:boolean; masked_email:string}

## 获取当前用户信息 — GET /api/users/me [auth]
resp: User

## 获取观看历史 — GET /api/users/me/history [auth]
params: limit(query):integer offset(query):integer
resp: [{history_id:string; watched_at:string; watch_seconds:integer; id:string; title:string; cover_url:string; author_username:string}]

## 清空观看历史 — DELETE /api/users/me/history [auth]

## 获取收藏列表 — GET /api/users/me/favorites [auth]
resp: [Video]

## 获取关注列表 — GET /api/users/me/following [auth]

## 获取粉丝列表 — GET /api/users/me/followers [auth]

## 获取合集列表 — GET /api/users/me/collections [auth]

## 获取拉黑列表 — GET /api/users/me/blocks [auth]

## GDPR 数据导出 — GET /api/users/me/export [auth]

## 获取用户公开信息 — GET /api/users/{id} [auth]
params: id(path!):string

## 关注用户 — POST /api/users/{id}/follow [auth]
params: id(path!):string

## 取消关注 — DELETE /api/users/{id}/follow [auth]
params: id(path!):string

## 拉黑用户 — POST /api/users/{id}/block [auth]
params: id(path!):string

## 取消拉黑 — DELETE /api/users/{id}/block [auth]
params: id(path!):string

## 获取视频列表 — GET /api/videos [auth]
params: category(query):string sort(query):recommend|latest|trending
resp: [Video]

## 获取视频详情 — GET /api/videos/{id} [auth]
params: id(path!):string
resp: Video

## 删除视频 — DELETE /api/videos/{id} [auth]
params: id(path!):string

## 点赞/取消点赞 — POST /api/videos/{id}/like [auth]
params: id(path!):string
resp: {liked:boolean}

## 上报观看进度 — POST /api/videos/{id}/watch [auth]
params: id(path!):string
body: {watch_seconds:integer; video_seconds:integer}
body(application/json): {watch_seconds:integer; video_seconds:integer}

## 更新视频信息 — PUT /api/videos/{id} [auth]
params: id(path!):string
body: {title:string; description:string; category:string; source_url:string}
body(application/json): {title:string; description:string; category:string; source_url:string}
resp: {success:boolean; moderation_warning:boolean; moderation_opinion:string}

## 获取评论列表 — GET /api/videos/{id}/comments [auth]
params: id(path!):string

## 发布评论 — POST /api/videos/{id}/comments [auth]
params: id(path!):string
body: {content:string; parent_id:string}
body(application/json): {content:string; parent_id:string}

## 获取字幕列表 — GET /api/videos/{id}/subtitles [auth]
params: id(path!):string

## 上传字幕（multipart/form-data） — POST /api/videos/{id}/subtitles [auth]
params: id(path!):string
multipart: {subtitle:string; language:string; label:string}
body(multipart/form-data): {subtitle:string; language:string; label:string}

## 上传前检查文件 hash — POST /api/videos/upload/check-hash [auth]
body: {hash:string}
body(application/json): {hash:string}
resp: {exists:boolean; existingVideoId:string}

## 初始化上传（分片或直传） — POST /api/videos/upload/init [auth]
body: {filename:string; contentType:string; direct:boolean}
body(application/json): {filename:string; contentType:string; direct:boolean}
resp: {uploadId:string; key:string; videoId:string; directUpload:boolean; putUrl:string}

## 获取分片上传预签名 URL — GET /api/videos/upload/presign-part [auth]
params: key(query!):string uploadId(query!):string partNumber(query!):integer
resp: {url:string}

## 获取单文件直传预签名 URL — GET /api/videos/upload/presign-put [auth]
params: key(query!):string contentType(query):string
resp: {url:string}

## 完成分片上传，创建视频记录 — POST /api/videos/upload/complete [auth]
body: {uploadId:string; key:string; videoId:string; parts:[{PartNumber:integer; ETag:string}]; title:string; description:string; category:string; source_url:string; file_hash:string}
body(application/json): {uploadId:string; key:string; videoId:string; parts:[{PartNumber:integer; ETag:string}]; title:string; description:string; category:string; source_url:string; file_hash:string}
resp: {success:boolean; id:string}

## 取消分片上传 — POST /api/videos/upload/abort [auth]
body: {uploadId:string; key:string}
body(application/json): {uploadId:string; key:string}

## 获取公告列表（登录用户返回未读） — GET /api/announcements [auth]

## 获取所有公告（不过滤已读） — GET /api/announcements/all [auth]

## 标记公告已读 — POST /api/announcements/{id}/read [auth]
params: id(path!):string

## 提交公投回答 — POST /api/referendums/{id}/responses [auth]
params: id(path!):string
body: {option_id:string; text_answer:string}
body(application/json): {option_id:string; text_answer:string}

## 创建合集 — POST /api/collections [auth]
body: {title:string; description:string}
body(application/json): {title:string; description:string}

## 获取合集详情 — GET /api/collections/{id} [auth]
params: id(path!):string

## 获取进行中的公投列表 — GET /api/referendums [auth]

## 管理员获取所有公投 — GET /api/admin/referendums [auth]

## 管理员创建公投 — POST /api/admin/referendums [auth]
body: {title:string; description:string; status:draft|active|closed; allow_text:boolean; options:[string]}
body(application/json): {title:string; description:string; status:draft|active|closed; allow_text:boolean; options:[string]}

## 获取公投结果 — GET /api/admin/referendums/{id}/results [auth]
params: id(path!):string

## 导出公投数据（CSV） — GET /api/admin/referendums/{id}/export [auth]
params: id(path!):string
resp(text/csv): string

## 获取所有公告 — GET /api/admin/announcements [auth]

## 创建公告 — POST /api/admin/announcements [auth]
body: {title:string; content:string; is_active:boolean}
body(application/json): {title:string; content:string; is_active:boolean}

## 修改用户角色 — PUT /api/admin/users/{id}/role [auth]
params: id(path!):string
body: {role:user|admin|video_moderation|content_review}
body(application/json): {role:user|admin|video_moderation|content_review}

## 发站内信或广播 — POST /api/admin/send-message [auth]
body: {user_id:string; title:string; content:string; broadcast:boolean}
body(application/json): {user_id:string; title:string; content:string; broadcast:boolean}

## 获取验证码配置 — GET /api/auth/captcha-config [auth]

## 获取法律文档 — GET /api/legal/{type} [auth]
params: type(path!):tos|privacy

## 搜索视频 — GET /api/search [auth]
params: q(query!):string

## 修改用户名 — PUT /api/users/me/username [auth]
body: {username:string}
body(application/json): {username:string}

## 修改个人简介 — PUT /api/users/me/bio [auth]
body: {bio:string}
body(application/json): {bio:string}

## 获取当前用户视频列表 — GET /api/users/me/videos [auth]

## 获取当前用户专栏列表 — GET /api/users/me/articles [auth]

## 获取当前用户动态列表 — GET /api/users/me/dynamics [auth]

## 更新历史记录设置 — PUT /api/users/me/history/settings [auth]
body: {enabled:boolean}
body(application/json): {enabled:boolean}

## 删除单条观看历史 — DELETE /api/users/me/history/{historyId} [auth]
params: historyId(path!):string

## 获取与指定用户的关注关系 — GET /api/users/{id}/follow-status [auth]
params: id(path!):string

## 获取指定用户粉丝列表 — GET /api/users/{id}/followers [auth]
params: id(path!):string

## 获取指定用户专栏列表 — GET /api/users/{id}/articles [auth]
params: id(path!):string

## 获取指定用户动态列表 — GET /api/users/{id}/dynamics [auth]
params: id(path!):string

## 获取积分余额和签到状态 — GET /api/coins/balance [auth]

## 每日签到 — POST /api/coins/checkin [auth]

## 收藏视频 — POST /api/videos/{id}/favorite [auth]
params: id(path!):string

## 取消收藏 — DELETE /api/videos/{id}/favorite [auth]
params: id(path!):string

## 检查是否已收藏 — GET /api/videos/{id}/favorited [auth]
params: id(path!):string

## 投币 — POST /api/videos/{id}/coin [auth]
params: id(path!):string
body: {amount:integer}
body(application/json): {amount:integer}

## 获取弹幕列表 — GET /api/videos/{id}/danmaku [auth]
params: id(path!):string

## 发送弹幕 — POST /api/videos/{id}/danmaku [auth]
params: id(path!):string
body: {content:string; time_sec:number; color:string; mode:string}
body(application/json): {content:string; time_sec:number; color:string; mode:string}

## 举报视频 — POST /api/videos/{id}/report [auth]
params: id(path!):string
body: {reason:string; details:string}
body(application/json): {reason:string; details:string}

## 删除字幕 — DELETE /api/videos/{id}/subtitles/{subId} [auth]
params: id(path!):string subId(path!):string

## 替换视频文件 — POST /api/videos/{id}/reupload [auth]
params: id(path!):string
body: {key:string}
body(application/json): {key:string}

## 发布动态 — POST /api/dynamics [auth]
body: {content:string}
body(application/json): {content:string}

## 删除动态 — DELETE /api/dynamics/{id} [auth]
params: id(path!):string

## 点赞动态 — POST /api/dynamics/{id}/like [auth]
params: id(path!):string

## 获取动态评论 — GET /api/dynamics/{id}/comments [auth]
params: id(path!):string

## 发布动态评论 — POST /api/dynamics/{id}/comments [auth]
params: id(path!):string
body: {content:string; parent_id:string}
body(application/json): {content:string; parent_id:string}

## 发布专栏 — POST /api/articles [auth]
body: {title:string; content:string; category:string}
body(application/json): {title:string; content:string; category:string}

## 获取专栏详情 — GET /api/articles/{id} [auth]
params: id(path!):string

## 删除专栏 — DELETE /api/articles/{id} [auth]
params: id(path!):string

## 获取专栏评论 — GET /api/articles/{id}/comments [auth]
params: id(path!):string

## 发布专栏评论 — POST /api/articles/{id}/comments [auth]
params: id(path!):string
body: {content:string; parent_id:string}
body(application/json): {content:string; parent_id:string}

## 点赞评论 — POST /api/comments/{id}/like [auth]
params: id(path!):string

## 删除评论 — DELETE /api/content-comments/{id} [auth]
params: id(path!):string

## 获取认证状态 — GET /api/verifications/me [auth]

## 提交认证申请 — POST /api/verifications/apply [auth]
multipart: {badge_type:blue|yellow; eligibility_type:string; org_name:string; reason:string}
body(multipart/form-data): {badge_type:blue|yellow; eligibility_type:string; org_name:string; reason:string}

## 获取消息未读数 — GET /api/messages/summary [auth]

## 获取站内信列表 — GET /api/messages/inbox [auth]

## 标记站内信已读 — POST /api/messages/inbox/read [auth]
body: {id:string}
body(application/json): {id:string}

## 获取私信会话列表 — GET /api/messages/conversations [auth]

## 获取私信记录 — GET /api/messages/direct/{userId} [auth]
params: userId(path!):string

## 获取我的工单列表 — GET /api/tickets [auth]

## 向合集添加视频 — POST /api/collections/{id}/items [auth]
params: id(path!):string
body: {video_id:string; part_title:string; sort_order:integer}
body(application/json): {video_id:string; part_title:string; sort_order:integer}

## 从合集移除视频 — DELETE /api/collections/{id}/items/{videoId} [auth]
params: id(path!):string videoId(path!):string

## 发送私信 — POST /api/messages/direct/{userId} [auth]
params: userId(path!):string
body: {content:string}
body(application/json): {content:string}
resp: CreatedResource

## 获取待审核列表 — GET /api/admin/audit/list [auth]

## 提交工单 — POST /api/tickets [auth]
body: {subject:string; content:string; images:[string]}
body(application/json): {subject:string; content:string; images:[string]}
resp: CreatedResource

## 提交审核决定 — POST /api/admin/audit/review [auth]
body: {item_id:string; item_type:video|article; decision:approved|rejected; note:string}
body(application/json): {item_id:string; item_type:video|article; decision:approved|rejected; note:string}

## 用户回复工单 — POST /api/tickets/{id}/reply [auth]
params: id(path!):string
body: {content:string; images:[string]}
body(application/json): {content:string; images:[string]}
resp: CreatedResource

## 获取审核报表 — GET /api/admin/audit/report [auth]

## 获取举报列表 — GET /api/admin/reports [auth]

## 处理举报 — POST /api/admin/reports/{id}/review [auth]
params: id(path!):string
body: {action:resolved|reject_video|dismissed; note:string}
body(application/json): {action:resolved|reject_video|dismissed; note:string}

## 获取待审评论列表 — GET /api/admin/comments/moderation [auth]

## 获取单个公投详情 — GET /api/referendums/{id} [auth]
params: id(path!):string

## 审核评论 — POST /api/admin/comments/{commentId}/review [auth]
params: commentId(path!):string
body: {action:approve|reject; opinion:string}
body(application/json): {action:approve|reject; opinion:string}

## 获取认证申请列表 — GET /api/admin/verifications [auth]

## 更新认证申请草稿 — PUT /api/admin/verifications/{id} [auth]
params: id(path!):string

## 审核认证申请 — POST /api/admin/verifications/{id}/review [auth]
params: id(path!):string
body: {action:approve|reject; note:string; label:string}
body(application/json): {action:approve|reject; note:string; label:string}

## 获取所有工单 — GET /api/admin/tickets [auth]

## 认领工单 — POST /api/admin/tickets/{id}/claim [auth]
params: id(path!):string

## 关闭工单 — POST /api/admin/tickets/{id}/close [auth]
params: id(path!):string

## 获取用户列表 — GET /api/admin/users [auth]
params: q(query):string limit(query):integer offset(query):integer

## 修改用户状态 — PUT /api/admin/users/{id}/status [auth]
params: id(path!):string
body: {status:active|banned; ban_reason:string}
body(application/json): {status:active|banned; ban_reason:string}

## 免去公益审核员身份 — POST /api/admin/users/{id}/dismiss-content-reviewer [auth]
params: id(path!):string

## 删除用户所有未通过视频 — POST /api/admin/users/{id}/purge-unapproved-videos [auth]
params: id(path!):string

## 获取所有视频列表 — GET /api/admin/videos [auth]

## 设置视频地区屏蔽 — PUT /api/admin/videos/{id}/geo-block [auth]
params: id(path!):string
body: {geo_block:string}
body(application/json): {geo_block:string}

## 管理员回复工单 — POST /api/admin/tickets/{id}/reply [auth]
params: id(path!):string
body: {content:string; images:[string]}
body(application/json): {content:string; images:[string]}

## 更新公告 — PUT /api/admin/announcements/{id} [auth]
params: id(path!):string
body: {title:string; content:string; is_active:boolean}
body(application/json): {title:string; content:string; is_active:boolean}

## 删除公告 — DELETE /api/admin/announcements/{id} [auth]
params: id(path!):string

## 更新公投 — PUT /api/admin/referendums/{id} [auth]
params: id(path!):string
body: {title:string; status:draft|active|closed; allow_text:boolean; options:[string]}
body(application/json): {title:string; status:draft|active|closed; allow_text:boolean; options:[string]}

## Verify email with a code — POST /api/auth/verify-email [auth]
body: {identifier:string; email:string; code:string}
body(application/json): {identifier:string; email:string; code:string}

## 发送找回密码验证码 — POST /api/auth/forgot-password/send-code [auth]
body: {email:string}
body(application/json): {email:string}

## 使用验证码重置密码 — POST /api/auth/forgot-password [auth]
body: {email:string; code:string; password:string}
body(application/json): {email:string; code:string; password:string}

## Confirm account deactivation with a code — POST /api/auth/deactivate/confirm [auth]
body: {code:string}
body(application/json): {code:string}

## 获取首页最新专栏 — GET /api/articles [auth]
params: limit(query):integer

## Edit article — PUT /api/articles/{id} [auth]
params: id(path!):string
multipart: {title:string; content:string; cover:string; images:[string]}
body(multipart/form-data): {title:string; content:string; cover:string; images:[string]}

## Reopen a closed ticket — POST /api/tickets/{id}/reopen [auth]
params: id(path!):string

## Claim a content review item — POST /api/admin/audit/claim [auth]
body: {item_id:string; item_type:video|article|dynamic}
body(application/json): {item_id:string; item_type:video|article|dynamic}

## Reopen a closed ticket as an administrator — POST /api/admin/tickets/{id}/reopen [auth]
params: id(path!):string

## Schemas

### User
{id:string; uid:integer; username:string; email:string; role:string; account_status:string; verification_badge:string; verification_label:string; created_at:string}

### Success
{success:boolean}

### Video
{id:string; title:string; description:string; video_key:string; stream_url:string; cover_url:string; author_id:string; author_username:string; author_uid:integer; status:string; views:integer; likes:integer; category:string; reupload:integer; created_at:string}

### CreatedResource
{success:boolean; id:string}

### Error
{error:string}

