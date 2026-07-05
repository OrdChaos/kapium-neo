import { showToast } from './toast';

export async function copyToClipboard(
  text: string,
  successMessage = '已复制',
  errorMessage = '复制失败，请手动复制',
): Promise<boolean> {
  const showSuccess = () => showToast(successMessage, 2000, 'success');
  const showError = () => showToast(errorMessage, 3000, 'error');

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess();
      return true;
    } catch {
      return fallbackCopy(text, showSuccess, showError);
    }
  }

  return fallbackCopy(text, showSuccess, showError);
}

function fallbackCopy(text: string, onSuccess: () => void, onError: () => void): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
      onSuccess();
      return true;
    } else {
      console.error('execCommand copy 失败');
      onError();
      return false;
    }
  } catch {
    onError();
    return false;
  }
}
