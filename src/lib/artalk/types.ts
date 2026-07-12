// ============================================================
// Artalk API 类型定义
// 由 openapi.json 生成，覆盖所有请求参数与响应结构
// ============================================================

// ---- 通用类型 ----

/** 通用 JSON 响应 */
export interface ArtalkResponse<T = unknown> {
  data?: T;
  msg?: string;
}

/** API 版本信息 */
export interface ApiVersion {
  app: string;
  commit_hash: string;
  version: string;
}

/** 前端配置 */
export interface FrontendConf {
  [key: string]: unknown;
}

/** 系统配置数据 */
export interface ConfData {
  frontend_conf: FrontendConf;
  version: ApiVersion;
}

// ---- 用户 ----

export interface CookedUser {
  badge_color: string;
  badge_name: string;
  email: string;
  id: number;
  is_admin: boolean;
  link: string;
  name: string;
  receive_email: boolean;
}

export interface CookedUserForAdmin extends CookedUser {
  comment_count: number;
  is_in_conf: boolean;
  last_ip: string;
  last_ua: string;
}

// ---- 页面 ----

export interface CookedPage {
  admin_only: boolean;
  date: string;
  id: number;
  key: string;
  pv: number;
  site_name: string;
  title: string;
  url: string;
  vote_down: number;
  vote_up: number;
}

// ---- 站点 ----

export interface CookedSite {
  first_url: string;
  id: number;
  name: string;
  urls: string[];
  urls_raw: string;
}

// ---- 评论 ----

export interface CookedComment {
  badge_color: string;
  badge_name: string;
  content: string;
  content_marked: string;
  date: string;
  email_encrypted: string;
  id: number;
  ip_region: string;
  is_allow_reply: boolean;
  is_collapsed: boolean;
  is_pending: boolean;
  is_pinned: boolean;
  is_verified: boolean;
  link: string;
  nick: string;
  page_key: string;
  page_url: string;
  rid: number;
  site_name: string;
  ua: string;
  user_id: number;
  visible: boolean;
  vote_down: number;
  vote_up: number;
}

// ---- 通知 ----

export interface CookedNotify {
  comment_id: number;
  id: number;
  is_emailed: boolean;
  is_read: boolean;
  read_link: string;
  user_id: number;
}

// ---- 认证提供者 ----

export interface AuthProviderInfo {
  icon: string;
  label: string;
  name: string;
  path?: string;
}

// ============================================================
// 认证 (Auth)
// ============================================================

export interface EmailLoginParams {
  email: string;
  code?: string;
  password?: string;
}

export interface EmailRegisterParams {
  email: string;
  code: string;
  password: string;
  name?: string;
  link?: string;
}

export interface EmailSendParams {
  email: string;
}

export interface UserLoginResponse {
  token: string;
  user: CookedUser;
}

export interface DataMergeCheckResponse {
  need_merge: boolean;
  user_names: string[];
}

export interface DataMergeApplyParams {
  user_name: string;
}

export interface DataMergeApplyResponse {
  deleted_user_count: number;
  update_comments_count: number;
  update_notifies_count: number;
  update_votes_count: number;
  /** 若目标用户非当前登录用户则需重新登录，此时为新的 token */
  user_token: string;
}

// ============================================================
// 评论 (Comment)
// ============================================================

export type CommentScope = 'page' | 'user' | 'site';
export type CommentSortBy = 'date_asc' | 'date_desc' | 'vote';
export type CommentType = 'all' | 'mentions' | 'mine' | 'pending';

export interface GetCommentsParams {
  page_key: string;
  site_name?: string;
  scope?: CommentScope;
  type?: CommentType;
  sort_by?: CommentSortBy;
  flat_mode?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  name?: string;
  email?: string;
  view_only_admin?: boolean;
}

export interface CommentListResponse {
  comments: CookedComment[];
  count: number;
  page: CookedPage;
  roots_count: number;
}

export interface CommentCreateParams {
  content: string;
  email: string;
  name: string;
  page_key: string;
  site_name: string;
  link?: string;
  page_title?: string;
  rid?: number;
  ua?: string;
}

export interface CommentUpdateParams {
  content: string;
  is_collapsed: boolean;
  is_pending: boolean;
  is_pinned: boolean;
  page_key: string;
  rid: number;
  site_name: string;
  email?: string;
  ip?: string;
  link?: string;
  nick?: string;
  ua?: string;
}

export interface CommentGetResponse {
  comment: CookedComment;
  reply_comment: CookedComment;
}

// ============================================================
// 页面 (Page)
// ============================================================

export interface GetPagesParams {
  site_name?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PageListResponse {
  count: number;
  pages: CookedPage[];
}

export interface PageUpdateParams {
  admin_only: boolean;
  key: string;
  site_name: string;
  title: string;
}

export interface PagePVParams {
  page_key: string;
  page_title?: string;
  site_name?: string;
}

export interface PagePVResponse {
  pv: number;
}

export interface PageFetchAllParams {
  site_name?: string;
}

export interface PageFetchStatusResponse {
  done: number;
  is_progress: boolean;
  msg: string;
  total: number;
}

// ============================================================
// 站点 (Site)
// ============================================================

export interface SiteCreateParams {
  name: string;
  urls: string[];
}

export interface SiteListResponse {
  count: number;
  sites: CookedSite[];
}

// ============================================================
// 用户管理 (User)
// ============================================================

export type UserListType = 'all' | 'admin' | 'in_conf';

export interface GetUsersParams {
  type: UserListType;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AdminUserListResponse {
  count: number;
  users: CookedUserForAdmin[];
}

export interface UserCreateParams {
  email: string;
  is_admin: boolean;
  name: string;
  receive_email: boolean;
  badge_color?: string;
  badge_name?: string;
  link?: string;
  password?: string;
}

export interface UserUpdateParams extends UserCreateParams {}

// ============================================================
// 系统 (System)
// ============================================================

export interface SendEmailParams {
  to_addr: string;
  subject: string;
  body: string;
}

export interface SettingsGetResponse {
  envs: string[];
  yaml: string;
}

export interface SettingsApplyParams {
  yaml: string;
}

export interface GetDomainResponse {
  is_trusted: boolean;
  origin: string;
}

export interface AuthProvidersResponse {
  anonymous: boolean;
  providers: AuthProviderInfo[];
}

// ============================================================
// 验证码 (Captcha)
// ============================================================

export interface CaptchaGetResponse {
  img_data: string;
}

export interface CaptchaStatusResponse {
  is_pass: boolean;
}

export interface CaptchaVerifyParams {
  value: string;
}

// ============================================================
// 通知 (Notify)
// ============================================================

export interface GetNotifiesParams {
  name: string;
  email: string;
}

export interface NotifyListResponse {
  count: number;
  notifies: CookedNotify[];
}

export interface NotifyReadAllParams {
  name: string;
  email: string;
}

// ============================================================
// 投票 (Vote)
// ============================================================

export type VoteTarget = 'comment' | 'page';
export type VoteChoice = 'up' | 'down';

export interface VoteCreateParams {
  name?: string;
  email?: string;
}

export interface VoteResponse {
  down: number;
  is_down: boolean;
  is_up: boolean;
  up: number;
}

// ============================================================
// 数据传输 (Transfer)
// ============================================================

export interface TransferImportParams {
  assumeyes?: boolean;
  json_data?: string;
  json_file?: string;
  target_site_name?: string;
  target_site_url?: string;
  url_keep_domain?: boolean;
  url_resolver?: boolean;
}

export interface TransferExportResponse {
  artrans: string;
}

export interface TransferUploadResponse {
  filename: string;
}

// ============================================================
// 上传 (Upload)
// ============================================================

export interface UploadResponse {
  file_name: string;
  file_type: string;
  public_url: string;
}

// ============================================================
// 统计 (Stats)
// ============================================================

export type StatsType =
  | 'latest_comments'
  | 'latest_pages'
  | 'pv_most_pages'
  | 'comment_most_pages'
  | 'page_pv'
  | 'site_pv'
  | 'page_comment'
  | 'site_comment'
  | 'rand_comments'
  | 'rand_pages';

export interface GetStatsParams {
  type: StatsType;
  site_name?: string;
  limit?: number;
  page_keys?: string;
}

// ============================================================
// SSO
// ============================================================

export interface SSOExchangeParams {
  token: string;
}

// ============================================================
// 用户信息
// ============================================================

export interface GetUserParams {
  email?: string;
  name?: string;
}

export interface UserInfoResponse {
  is_login: boolean;
  notifies: CookedNotify[];
  notifies_count: number;
  user: CookedUser;
}

export interface UserLoginParams {
  email: string;
  password: string;
  name?: string;
}

export interface UserStatusResponse {
  is_admin: boolean;
  is_login: boolean;
}

export interface UserInfoUpdateParams {
  email: string;
  name: string;
  code?: string;
  link?: string;
}

export interface UserInfoUpdateResponse {
  user: CookedUser;
}
