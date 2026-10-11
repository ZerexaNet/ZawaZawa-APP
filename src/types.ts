// ZawaZawa API 数据模型（依据 OpenAPI 文档 + 线上接口实测）

export interface User {
  id: string;
  uid: string;
  username: string;
  bio?: string;
  gravatar_url?: string;
  avatar_url?: string;
  email_verified?: boolean;
  role?: string; // user | admin | video_moderation | content_review
  permissions?: string[];
  follower_count?: number;
  following_count?: number;
  video_count?: number;
  verification_badge?: string | null;
  verification_label?: string | null;
  subscription_status?: string;
  is_following?: boolean;
  account_status?: string;
  ban_reason?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  category?: string; // "大类 / 小类"
  status?: string; // pending_review | approved | rejected
  views?: number;
  likes?: number;
  fav_count?: number;
  coin_count?: number;
  confusion_count?: number;
  comment_count?: number;
  duration?: number;
  stream_url?: string;
  cover_url?: string;
  external_cover_url?: string;
  external_player_url?: string;
  source_url?: string;
  ip_location?: string;
  created_at?: string;
  scheduled_at?: string;
  author_id?: string;
  author_uid?: string;
  author_username?: string;
  author_gravatar_url?: string;
  author_verification_badge?: string | null;
  author_verification_label?: string | null;
  author_ip_location?: string;
  geo_block?: string | null;
  liked?: boolean;
  favorited?: boolean;
  confused?: boolean;
  reupload?: { status?: string; pending?: boolean } | null;
  [k: string]: unknown;
}

export interface Article {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  cover_url?: string;
  views?: number;
  likes?: number;
  created_at?: string;
  updated_at?: string;
  author_username?: string;
  author_uid?: string;
  author_gravatar_url?: string;
  author_verification_badge?: string | null;
  author_verification_label?: string | null;
  author_ip_location?: string;
  status?: string;
  [k: string]: unknown;
}

export interface Post {
  id: string;
  content: string;
  images?: string[];
  video_id?: string;
  like_count?: number;
  liked?: boolean;
  comment_count?: number;
  created_at?: string;
  author_id?: string;
  author_username?: string;
  author_gravatar_url?: string;
  author_verification_badge?: string | null;
  author_verification_label?: string | null;
  [k: string]: unknown;
}

export interface Comment {
  id: string;
  content: string;
  parent_id?: string | null;
  author_id?: string;
  author_uid?: string;
  username?: string;
  uid?: string;
  gravatar_url?: string;
  verification_badge?: string | null;
  verification_label?: string | null;
  ip_location?: string;
  like_count?: number;
  liked?: boolean;
  reply_count?: number;
  pending?: boolean;
  moderation_opinion?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface Danmaku {
  id: string;
  content: string;
  time_sec?: number;
  time?: number;
  color?: string;
  mode?: string; // scroll | top | bottom
  fontsize?: number;
  username?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface Subtitle {
  id: string;
  label?: string;
  language?: string;
  url?: string;
  source?: string; // manual | ai
  created_at?: string;
  [k: string]: unknown;
}

export interface Collection {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  video_count?: number;
  items?: CollectionItem[];
  created_at?: string;
  [k: string]: unknown;
}

export interface CollectionItem {
  video_id: string;
  part_title?: string;
  sort_order?: number;
  added_at?: string;
  video?: Video;
  [k: string]: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export interface Referendum {
  id: string;
  title: string;
  description?: string;
  options?: ReferendumOption[];
  allow_text?: boolean;
  status?: string; // active | ended
  response_count?: number;
  my_response?: { option_id?: string; text_answer?: string; id?: string } | null;
  created_at?: string;
  [k: string]: unknown;
}

export interface ReferendumOption {
  id: string;
  label: string;
  vote_count?: number;
  percent?: number;
  [k: string]: unknown;
}

export interface InboxMessage {
  id: string;
  title: string;
  content: string;
  is_read?: number | boolean;
  created_at?: string;
  [k: string]: unknown;
}

export interface Conversation {
  other_user: User;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  [k: string]: unknown;
}

export interface DirectMessage {
  id: string;
  sender_id?: string;
  content: string;
  created_at?: string;
  pending?: boolean;
  [k: string]: unknown;
}

export interface DirectThread {
  other_user: { id: string; uid?: string; username: string; gravatar_url?: string };
  messages: DirectMessage[];
  [k: string]: unknown;
}

export interface TicketMessage {
  id: string;
  sender_id?: string;
  sender_role?: string; // user | admin | system
  username?: string;
  content: string;
  image_urls?: string[];
  created_at?: string;
  [k: string]: unknown;
}

export interface Ticket {
  id: string;
  subject: string;
  status?: string; // open | closed
  last_message?: string;
  updated_at?: string;
  created_at?: string;
  messages?: TicketMessage[];
  [k: string]: unknown;
}

export interface HistoryEntry {
  history_id: string;
  id?: string; // video id
  title?: string;
  cover_url?: string;
  watched_at?: string;
  watch_seconds?: number;
  video_seconds?: number;
  author_username?: string;
  author_gravatar_url?: string;
  author_verification_badge?: string | null;
  author_verification_label?: string | null;
  [k: string]: unknown;
}

export interface FavoriteEntry extends Video {
  favorited_at?: string;
  [k: string]: unknown;
}

export interface VerificationRequest {
  id: string;
  user_id?: string;
  badge_type?: string; // blue | yellow
  org_type?: string; // enterprise | media | personal
  org_name?: string;
  eligibility_type?: string;
  external_platform?: string;
  follower_count?: number | null;
  reason?: string;
  current_label?: string;
  label?: string;
  status?: string; // pending | approved | rejected
  admin_note?: string;
  review_note?: string;
  materials_json?: string; // JSON 字符串
  materials?: { kind: string; url?: string }[];
  certification_letter?: string;
  created_at?: string;
  reviewed_at?: string;
  [k: string]: unknown;
}

export interface AuditItem {
  id: string;
  item_type: string; // video | article
  author_id?: string;
  author_username?: string;
  title?: string;
  status?: string; // pending | processing | approved | rejected
  claimed_by?: string;
  moderation_opinion?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface ReportItem {
  id: string;
  reason?: string;
  details?: string;
  reporter_username?: string;
  target_type?: string;
  target_id?: string;
  status?: string; // pending | resolved
  resolved_action?: string;
  video?: Video;
  created_at?: string;
  [k: string]: unknown;
}

export interface ModerationComment {
  id: string;
  content: string;
  username?: string;
  moderation_opinion?: string;
  status?: string;
  target_type?: string;
  target_id?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface NotificationItem {
  id: string;
  type?: string;
  content?: string;
  is_read?: number | boolean;
  related_user?: { username?: string; id?: string };
  related_video_id?: string;
  related_content_type?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface Membership {
  username?: string;
  active?: boolean;
  plan?: string;
  payment_method?: string;
  can_checkout?: boolean;
  subscription_status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  pending_plan?: string;
  pending_payment_method?: string;
  has_pending_checkout?: boolean;
  url?: string;
  [k: string]: unknown;
}

export interface CoinsInfo {
  balance: number;
  checkedIn: boolean;
  [k: string]: unknown;
}

export interface CaptchaConfig {
  geetest_enabled: boolean;
  geetest_captcha_id?: string;
  turnstile_enabled: boolean;
  [k: string]: unknown;
}

export interface PageResult<T> {
  items?: T[];
  total?: number;
  offset?: number;
  limit?: number;
}

export function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.videos)) return o.videos as T[];
  }
  return [];
}

export function pickVideo(v: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (v[f] !== undefined) out[f] = v[f];
  return out;
}
