/**
 * Artalk 认证 API
 *
 * 覆盖：邮箱登录/注册/验证码、SSO 交换、用户信息查询/更新、
 * 登录状态、数据合并检查/应用 等认证相关接口。
 */
import type { ArtalkClient } from './client';
import type {
  UserLoginResponse,
  EmailLoginParams,
  EmailRegisterParams,
  EmailSendParams,
  DataMergeCheckResponse,
  DataMergeApplyParams,
  DataMergeApplyResponse,
  GetUserParams,
  UserInfoResponse,
  UserLoginParams,
  UserStatusResponse,
  UserInfoUpdateParams,
  UserInfoUpdateResponse,
  SSOExchangeParams,
} from './types';

/** 邮箱 + 验证码/密码登录 */
export function loginByEmail(c: ArtalkClient, data: EmailLoginParams): Promise<UserLoginResponse> {
  return c.post('/auth/email/login', data);
}

/** 邮箱注册（验证码必填，若用户已存在则更新） */
export function registerByEmail(
  c: ArtalkClient,
  data: EmailRegisterParams,
): Promise<UserLoginResponse> {
  return c.post('/auth/email/register', data);
}

/** 发送邮箱验证码 */
export function sendVerifyEmail(c: ArtalkClient, data: EmailSendParams): Promise<{ msg: string }> {
  return c.post('/auth/email/send', data);
}

/** 用户名/邮箱 + 密码登录，获取 JWT token */
export function login(c: ArtalkClient, data: UserLoginParams): Promise<UserLoginResponse> {
  return c.post('/user/access_token', data);
}

/** 获取用户信息（需登录后的 token） */
export function getUser(c: ArtalkClient, params: GetUserParams = {}): Promise<UserInfoResponse> {
  const query: Record<string, unknown> = {};
  if (params.email) query.email = params.email;
  if (params.name) query.name = params.name;
  return c.get('/user', query);
}

/** 更新用户资料 */
export function updateProfile(
  c: ArtalkClient,
  data: UserInfoUpdateParams,
): Promise<UserInfoUpdateResponse> {
  return c.post('/user', data);
}

/** 获取登录状态（通过 Authorization header） */
export function getUserStatus(
  c: ArtalkClient,
  params: GetUserParams = {},
): Promise<UserStatusResponse> {
  const query: Record<string, unknown> = {};
  if (params.email) query.email = params.email;
  if (params.name) query.name = params.name;
  return c.get('/user/status', query);
}

/** 检查是否有同邮箱多账户需要合并 */
export function checkDataMerge(c: ArtalkClient): Promise<DataMergeCheckResponse> {
  return c.get('/auth/merge');
}

/** 执行数据合并 */
export function applyDataMerge(
  c: ArtalkClient,
  data: DataMergeApplyParams,
): Promise<DataMergeApplyResponse> {
  return c.post('/auth/merge', data);
}

/** SSO: 用第三方 IdP access token 换取 Artalk JWT */
export function ssoExchange(c: ArtalkClient, data: SSOExchangeParams): Promise<UserLoginResponse> {
  return c.post('/sso/exchange', data);
}
