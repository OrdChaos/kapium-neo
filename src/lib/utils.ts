import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function estimateReadTime(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const enWords = (text.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length;
  return Math.ceil(cjkChars / 400 + enWords / 200) || 1;
}
