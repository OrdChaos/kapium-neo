/**
 * Artalk 文件上传 API
 *
 * 上传图片等文件到 Artalk 服务器。
 */
import type { ArtalkClient } from './client';
import type { UploadResponse } from './types';

/**
 * 上传文件
 * @param file - 文件 Blob 或 File 对象
 * @param filename - 可选文件名
 */
export function uploadFile(
  c: ArtalkClient,
  file: File | Blob,
  filename?: string,
): Promise<UploadResponse> {
  return c.upload('/upload', file, filename);
}
