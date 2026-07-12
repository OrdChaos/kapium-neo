/**
 * Artalk 系统 API
 *
 * 覆盖：系统配置、版本、登录提供者、域名信息、
 * 设置读取/应用、模板获取、邮件发送。
 */
import type { ArtalkClient } from './client';
import type {
  ConfData,
  ApiVersion,
  AuthProvidersResponse,
  GetDomainResponse,
  SettingsGetResponse,
  SettingsApplyParams,
  SendEmailParams,
} from './types';

/** 获取前端配置（包括验证码、评论分页等 UI 相关配置） */
export function getConf(c: ArtalkClient): Promise<ConfData> {
  return c.get('/conf');
}

/** 获取 Artalk 版本信息 */
export function getVersion(c: ArtalkClient): Promise<ApiVersion> {
  return c.get('/version');
}

/** 获取社交登录提供者列表 */
export function getAuthProviders(c: ArtalkClient): Promise<AuthProvidersResponse> {
  return c.get('/conf/auth/providers');
}

/** 获取域名信任状态 */
export function getDomain(c: ArtalkClient, url?: string): Promise<GetDomainResponse> {
  return c.get('/conf/domain', url ? { url } : undefined);
}

/** 获取服务器配置（含 YAML 与环境变量列表） */
export function getSettings(c: ArtalkClient): Promise<SettingsGetResponse> {
  return c.get('/settings');
}

/** 保存并应用配置（需要重启服务生效） */
export function applySettings(c: ArtalkClient, data: SettingsApplyParams): Promise<unknown> {
  return c.put('/settings', data);
}

/** 获取指定语言的配置模板（用于前端设置页渲染） */
export function getSettingsTemplate(c: ArtalkClient, locale: string): Promise<{ yaml: string }> {
  return c.get(`/settings/template/${locale}`);
}

/** 发送测试邮件 */
export function sendEmail(c: ArtalkClient, data: SendEmailParams): Promise<unknown> {
  return c.post('/send_email', data);
}
