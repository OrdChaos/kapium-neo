/**
 * Artalk 数据传输 API
 *
 * 覆盖：导出 Artrans JSON、上传导入文件、执行导入。
 */
import type { ArtalkClient } from './client';
import type { TransferExportResponse, TransferUploadResponse, TransferImportParams } from './types';

/** 导出全站数据（Artrans JSON 格式） */
export function exportArtrans(c: ArtalkClient): Promise<TransferExportResponse> {
  return c.get('/transfer/export');
}

/** 上传导入文件（multipart/form-data） */
export function uploadArtrans(
  c: ArtalkClient,
  file: File | Blob,
  filename?: string,
): Promise<TransferUploadResponse> {
  return c.upload('/transfer/upload', file, filename);
}

/** 执行数据导入 */
export function importArtrans(c: ArtalkClient, data: TransferImportParams): Promise<string> {
  return c.post('/transfer/import', data);
}
