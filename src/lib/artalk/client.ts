/**
 * Artalk API 基础 HTTP 客户端
 *
 * 封装 fetch 请求，自动拼接 base URL、注入认证头和 site_name。
 * 每个 API 模块独立文件，通过本客户端实例通信。
 */
import type { ArtalkConfig } from '@/config/artalk';
import { artalkConfig as defaultConfig } from '@/config/artalk';

export class ArtalkClient {
  readonly server: string;
  readonly siteName: string;
  private token: string;

  constructor(config: Partial<ArtalkConfig> = {}) {
    const merged = { ...defaultConfig, ...config };
    this.server = merged.server.replace(/\/+$/, '');
    this.siteName = merged.siteName;
    this.token = merged.adminToken ?? '';
  }

  /** 更新管理 token */
  setToken(token: string): void {
    this.token = token;
  }

  /** 获取当前 token */
  getToken(): string {
    return this.token;
  }

  /** 构造完整 API URL */
  url(path: string, params?: Record<string, unknown>): string {
    const urlObj = new URL(`${this.server}/api/v2${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          urlObj.searchParams.set(key, String(value));
        }
      }
    }
    return urlObj.toString();
  }

  /** 构造请求头 */
  private headers(contentType?: string): HeadersInit {
    const h: Record<string, string> = {};
    if (contentType) h['Content-Type'] = contentType;
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  /** 发送 GET 请求 */
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.url(path, params), {
      method: 'GET',
      headers: this.headers(),
    });
    return this.handleResponse<T>(res);
  }

  /** 发送 POST 请求 */
  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: this.headers('application/json'),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  /** 发送 PUT 请求 */
  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'PUT',
      headers: this.headers('application/json'),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(res);
  }

  /** 发送 DELETE 请求 */
  async delete<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'DELETE',
      headers: this.headers(),
    });
    return this.handleResponse<T>(res);
  }

  /** 上传文件 (multipart/form-data) */
  async upload<T>(path: string, file: File | Blob, filename?: string): Promise<T> {
    const formData = new FormData();
    formData.append('file', file, filename);
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: formData,
    });
    return this.handleResponse<T>(res);
  }

  /** 统一处理响应 */
  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const errorBody = await res.json();
        if (errorBody?.msg) msg = errorBody.msg;
      } catch {
        // non-JSON body
      }
      throw new Error(`[Artalk] ${msg}`);
    }
    // 某些接口可能返回 HTML 或空内容
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  /** 验证码 iframe URL（Turnstile 等 iframe 型验证码使用） */
  getCaptchaUrl(): string {
    return `${this.server}/api/v2/captcha/?t=${Date.now()}`;
  }
}

/** 默认客户端实例 */
export const artalk = new ArtalkClient();
