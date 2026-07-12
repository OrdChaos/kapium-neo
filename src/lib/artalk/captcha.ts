/**
 * Artalk 验证码 API
 *
 * 覆盖：获取验证码、验证、状态查询。
 */
import type { ArtalkClient } from './client';
import type { CaptchaGetResponse, CaptchaStatusResponse, CaptchaVerifyParams } from './types';

/** 获取验证码（返回 base64 图片或 HTML 页面） */
export function getCaptcha(c: ArtalkClient): Promise<CaptchaGetResponse> {
  return c.get('/captcha');
}

/** 校验验证码 */
export function verifyCaptcha(c: ArtalkClient, data: CaptchaVerifyParams): Promise<unknown> {
  return c.post('/captcha/verify', data);
}

/** 获取当前用户的验证码通过状态 */
export function getCaptchaStatus(c: ArtalkClient): Promise<CaptchaStatusResponse> {
  return c.get('/captcha/status');
}
