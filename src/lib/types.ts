// ZawaZawa API types (derived from OpenAPI docs + live probing)

export type Role = 'user' | 'video_moderation' | 'content_review' | 'admin';
export type Badge = 'blue' | 'green' | 'yellow' | 'pink' | '' | null;

export interface User {
  id: string;
  uid?: number;
  username: string;
  email?: string;
  bio?: string;
  role?: Role;
  created_at?: string;
  gravatar_url?: string;
  avatar_url?: string;
  verification_badge?: Badge;
  verification_label?: string;
  follower_count?: number;
  following_count?: number;
  video_count?: number;
  is_following?: boolean;
  account_status?: 'active' | 'banned' | string;
  ban_reason?: string;
  permissions?: string[];
  subscription_status?: string;
  coins?: number;
  [k: string]: any;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  category?: string;            // "大类 / 子类"
  source_url?: string;
  status?: 'pending_review' | 'approved' | 'rejected' | 'deleted' | string;
  views?: number;
  likes?: number;
  fav_count?: number;
  coin_count?: number;
  confusion_count?: number;
  comment_count?: number;
  duration?: number;
  duration_sec?: number;
  stream_url?: string;
  cover_url?: string;
  external_cover_url?: string;
  external_player_url?: string;
  ip_location?: string;
  author_username?: string;
  author_uid?: number;
  author_id?: string;
  author_gravatar_url?: string;
  author_verification_badge?: Badge;
  author_verification_label?: string;
  created_at?: string;
  updated_at?: string;
  scheduled_at?: string;
  geo_block?: string | null;
  moderation_opinion?: string;
  liked?: boolean;
  confused?: boolean;
  favorited?: boolean;
  [k: string]: any;
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
  status?: string;
  author_username?: string;
  author_uid?: number;
  author_gravatar_url?: string;
  author_verification_badge?: Badge;
  author_verification_label?: string;
  author_ip_location?: string;
  created_at?: string;
  [k: string]: any;
}

export interface Post { // 动态
  id: string;
  content?: string;
  text?: string;
  image_urls?: string[];
  likes?: number;
  like_count?: number;
  liked?: boolean;
  comment_count?: number;
  author_username?: string;
  author_uid?: number;
  author_gravatar_url?: string;
  author_verification_badge?: Badge;
  created_at?: string;
  [k: string]: any;
}

export interface Comment {
  id: string;
  content: string;
  parent_id?: string | null;
  username?: string;
  uid?: number;
  author_id?: string;
  gravatar_url?: string;
  verification_badge?: Badge;
  verification_label?: string;
  ip_location?: string;
  like_count?: number;
  liked?: boolean;
  reply_count?: number;
  pending?: boolean;
  moderation_opinion?: string;
  created_at?: string;
  [k: string]: any;
}

export interface Danmaku {
  id?: string;
  content: string;
  time_sec?: number;
  time?: number;
  color?: string;
  mode?: 'scroll' | 'top' | 'bottom' | string;
  fontsize?: number;
  username?: string;
  created_at?: string;
  [k: string]: any;
}

export interface Subtitle {
  id: string;
  label?: string;
  name?: string;
  language?: string;
  url: string;
  source?: 'upload' | 'ai' | string;
  [k: string]: any;
}

export interface Collection {
  id: string;
  title: string;
  description?: string;
  item_count?: number;
  video_count?: number;
  created_at?: string;
  items?: CollectionItem[];
  [k: string]: any;
}
export interface CollectionItem {
  id?: string;
  video_id: string;
  part_title?: string;
  sort_order?: number;
  title?: string;
  cover_url?: string;
  duration?: string;
  [k: string]: any;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active?: boolean;
  created_at?: string;
  [k: string]: any;
}

export interface ReferendumOption {
  id: string;
  label: string;
  text?: string;
  vote_count?: number;
  count?: number;
  [k: string]: any;
}
export interface Referendum {
  id: string;
  title: string;
  description?: string;
  options?: ReferendumOption[];
  allow_text?: boolean;
  response_count?: number;
  status?: 'active' | 'ended' | string;
  my_response?: string | null;
  created_at?: string;
  [k: string]: any;
}

export interface CoinState {
  balance: number;
  checkedIn?: boolean;
  total_earned?: number;
  [k: string]: any;
}

export interface HistoryEntry {
  history_id: string;
  watched_at?: string;
  watch_seconds?: number;
  video_seconds?: number;
  id: string;
  title?: string;
  cover_url?: string;
  stream_url?: string;
  author_username?: string;
  author_uid?: number;
  author_gravatar_url?: string;
  author_verification_badge?: Badge;
  author_verification_label?: string;
  created_at?: string;
  [k: string]: any;
}

export interface FavoriteEntry extends Video {
  favorited_at?: string;
}

export interface InboxMessage {
  id: string;
  title: string;
  content: string;
  is_read?: number | boolean;
  sender_username?: string;
  created_at?: string;
  [k: string]: any;
}

export interface Conversation {
  user_id?: string;
  other_user?: { uid?: number; id?: string; username: string; gravatar_url?: string };
  uid?: number;
  username?: string;
  gravatar_url?: string;
  last_message?: string;
  last_at?: string;
  unread?: number;
  [k: string]: any;
}

export interface DirectMessage {
  id: string;
  sender_id?: string;
  content: string;
  image_urls?: string[];
  created_at?: string;
  [k: string]: any;
}

export interface TicketMessage {
  id: string;
  sender_id?: string;
  sender_role?: 'user' | 'support' | string;
  username?: string;
  content: string;
  image_urls?: string[];
  created_at?: string;
  [k: string]: any;
}
export interface Ticket {
  id: string;
  subject?: string;
  status?: 'open' | 'pending' | 'resolved' | 'closed' | string;
  messages?: TicketMessage[];
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
}

export interface Notification {
  id: string;
  type?: string;
  content?: string;
  is_read?: number | boolean;
  related_user?: { username?: string; id?: string };
  related_video_id?: string;
  related_content_type?: string;
  created_at?: string;
  [k: string]: any;
}

export interface VerificationRequest {
  id: string;
  status?: 'pending' | 'approved' | 'rejected' | 'draft' | string;
  badge_type?: 'blue' | 'yellow' | string;
  org_type?: string;
  org_name?: string;
  eligibility_type?: string;
  external_platform?: string;
  follower_count?: number;
  reason?: string;
  note?: string;
  current_label?: string;
  materials?: { kind?: string; url?: string; name?: string }[];
  created_at?: string;
  reviewed_at?: string;
  [k: string]: any;
}

export interface Membership {
  username?: string;
  active?: boolean;
  plan?: 'month' | 'year' | string;
  payment_method?: string;
  subscription_status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  pending_plan?: string;
  pending_payment_method?: string;
  has_pending_checkout?: boolean;
  can_checkout?: boolean;
  url?: string;
  [k: string]: any;
}

export interface AuditItem {
  id: string;
  item_type?: 'video' | 'article' | string;
  author_id?: string;
  status?: string;
  title?: string;
  claimed_by?: string;
  created_at?: string;
  [k: string]: any;
}

export interface CaptchaConfig {
  geetest_enabled?: boolean;
  geetest_captcha_id?: string;
  turnstile_enabled?: boolean;
  [k: string]: any;
}

export interface Paginated<T> {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
  [k: string]: any;
}
