/**
 * Artalk 用户管理 API（管理员接口）
 *
 * 覆盖：用户列表、创建、更新、删除、登录。
 */
import type { ArtalkClient } from './client';
import type {
  GetUsersParams,
  AdminUserListResponse,
  UserCreateParams,
  CookedUserForAdmin,
  UserUpdateParams,
  UserListType,
  UserLoginParams,
  UserLoginResponse,
} from './types';

/** 获取用户列表 */
export function getUsers(c: ArtalkClient, params: GetUsersParams): Promise<AdminUserListResponse> {
  const { type, ...rest } = params;
  const query: Record<string, unknown> = {};
  if (rest.limit !== undefined) query.limit = rest.limit;
  if (rest.offset !== undefined) query.offset = rest.offset;
  if (rest.search) query.search = rest.search;
  return c.get(`/users/${type}`, query);
}

/** 创建用户 */
export function createUser(c: ArtalkClient, data: UserCreateParams): Promise<CookedUserForAdmin> {
  return c.post('/users', data);
}

/** 更新用户 */
export function updateUser(
  c: ArtalkClient,
  id: number,
  data: UserUpdateParams,
): Promise<CookedUserForAdmin> {
  return c.put(`/users/${id}`, data);
}

/** 删除用户 */
export function deleteUser(c: ArtalkClient, id: number): Promise<unknown> {
  return c.delete(`/users/${id}`);
}

/** 管理员登录，返回 token */
export function login(c: ArtalkClient, data: UserLoginParams): Promise<UserLoginResponse> {
  return c.post('/user/access_token', data);
}
