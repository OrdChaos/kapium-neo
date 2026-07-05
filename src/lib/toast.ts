type ToastVariant = 'success' | 'error' | 'default';

export function showToast(message: string, duration = 2000, variant: ToastVariant = 'default') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText =
      'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;pointer-events:none;display:flex;flex-direction:column;gap:0.5rem;align-items:flex-end;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.textContent = message;

  const isErr = variant === 'error';
  const bg = isErr ? 'var(--destructive)' : 'var(--primary)';
  const fg = isErr ? 'var(--destructive-foreground)' : 'var(--primary-foreground)';

  toast.style.cssText = `
    pointer-events: auto;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    background: ${bg};
    color: ${fg};
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    opacity: 0;
    transform: translateY(0.5rem);
    transition: opacity 0.3s ease, transform 0.3s ease;
    max-width: 90vw;
    word-break: break-all;
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(0.5rem)';
    setTimeout(() => {
      toast.remove();
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}
