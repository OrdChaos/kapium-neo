import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Smile, MapPin, Globe, Monitor } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { showToast } from '@/lib/toast';
import insane from 'insane';
import { ArtalkClient } from '@/lib/artalk/client';
import type { CommentItem } from '@/lib/artalk/adapter';
import { fetchComments, postComment } from '@/lib/artalk/adapter';
import { getConf } from '@/lib/artalk/system';
import { getCaptchaStatus, getCaptcha, verifyCaptcha } from '@/lib/artalk/captcha';
import { login as adminLogin } from '@/lib/artalk/user';
import { cn } from '@/lib/utils';
import { artalkConfig } from '@/config/artalk';

interface FormData {
  nickname: string;
  email: string;
  website: string;
  content: string;
}

interface NestedComment extends CommentItem {
  replies: NestedComment[];
  replyToNick?: string;
}

function buildCommentTree(flat: CommentItem[]): NestedComment[] {
  const map = new Map<number, NestedComment>();
  const roots: NestedComment[] = [];
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(c.parentId);
      if (!parent) continue;
      if (parent.parentId === null) {
        parent.replies.push(node);
      } else {
        let root = parent;
        while (root.parentId !== null) {
          const p = map.get(root.parentId);
          if (!p) break;
          root = p;
        }
        node.replyToNick = parent.nickname;
        root.replies.push(node);
      }
    }
  }

  for (const root of roots) {
    root.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return roots;
}

function formatTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days <= 3) return `${days}天前`;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type UaInfo = { os: string; browser: string };

function parseUa(ua: string): UaInfo {
  const info: UaInfo = { os: '', browser: '' };
  if (!ua) return info;
  if (ua.includes('Windows')) info.os = 'Windows';
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) info.os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) info.os = 'Linux';
  else if (ua.includes('Android')) info.os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) info.os = 'iOS';
  if (ua.includes('Edg/')) info.browser = 'Edge';
  else if (ua.includes('Firefox/')) info.browser = 'Firefox';
  else if (ua.includes('Chrome/')) info.browser = 'Chrome';
  else if (ua.includes('Safari/')) info.browser = 'Safari';
  return info;
}

const OS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Windows: Monitor,
  macOS: Monitor,
  Linux: Monitor,
  Android: Monitor,
  iOS: Monitor,
};

interface FrontendConf {
  emoticons?: string;
  gravatar?: { mirror?: string; params?: string };
  pagination?: { pageSize?: number; readMore?: boolean; autoLoad?: boolean };
  noComment?: string;
  placeholder?: string;
  sendBtn?: string;
  preview?: boolean;
}

const DEFAULT_CONF: FrontendConf = {
  emoticons: 'https://www.ordchaos.com/owo.json',
  gravatar: { mirror: 'https://www.gravatar.com/avatar/', params: 'd=identicon&s=80' },
  pagination: { pageSize: 10, readMore: true, autoLoad: false },
  noComment: '',
  placeholder: '',
  sendBtn: '',
  preview: true,
};

function sanitizeCommentHtml(html: string): string {
  try {
    const fn = typeof insane === 'function' ? insane : (insane as any)?.default;
    if (typeof fn !== 'function') return html.replace(/<[^>]*>/g, '');
    return fn(html, {
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedTags: [
        'a',
        'abbr',
        'b',
        'blockquote',
        'br',
        'caption',
        'code',
        'del',
        'details',
        'div',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hr',
        'i',
        'img',
        'ins',
        'kbd',
        'li',
        'main',
        'mark',
        'ol',
        'p',
        'pre',
        'section',
        'span',
        'strike',
        'strong',
        'sub',
        'summary',
        'sup',
        'table',
        'tbody',
        'td',
        'th',
        'thead',
        'tr',
        'u',
        'ul',
      ],
      allowedAttributes: {
        '*': ['title'],
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'atk-emoticon', 'loading'],
        code: ['class'],
        span: ['class', 'style'],
      },
    });
  } catch {
    return html.replace(/<[^>]*>/g, '');
  }
}

function safeMarkdownRender(content: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeRaw]}
      components={MARKDOWN_COMPONENTS}
    >
      {sanitizeCommentHtml(content)}
    </ReactMarkdown>
  );
}

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:'];

type CaptchaState =
  | {
      type: 'image';
      imgData: string;
      target: 'top' | number;
      onVerify: (code: string) => Promise<void>;
      onRefresh: () => Promise<void>;
      onCancel: () => void;
    }
  | {
      type: 'iframe';
      url: string;
      target: 'top' | number;
      onVerified: () => void;
      onCancel: () => void;
    }
  | null;

function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    try {
      parsed = new URL(`https://${url}`);
    } catch {
      return undefined;
    }
  }
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) return undefined;
  return parsed.href;
}

function sanitizeHtml(html: string): string {
  try {
    const fn = typeof insane === 'function' ? insane : (insane as any)?.default;
    if (typeof fn !== 'function') {
      console.warn(
        '[sanitizeHtml] insane is not callable, type:',
        typeof insane,
        'keys:',
        Object.keys(insane || {}),
      );
      return html.replace(/<[^>]*>/g, '');
    }
    return fn(html, {
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedTags: ['a', 'b', 'br', 'code', 'em', 'i', 'p', 'span', 'strong', 'u'],
      allowedAttributes: {
        a: ['href', 'rel', 'target'],
      },
    });
  } catch (e) {
    console.error('[sanitizeHtml] ERROR:', e);
    return html.replace(/<[^>]*>/g, '');
  }
}

const ALLOWED_IMAGE_HOST = 'www.ordchaos.com';
const REDIRECT_COMMENT = '/redirect-comment/';

const TRUSTED_HOST_SUFFIXES = ['ordchaos.com', 'ordchaos.top'];

function isTrustedHost(hostname: string): boolean {
  return TRUSTED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith('.' + suffix),
  );
}

const MARKDOWN_COMPONENTS = {
  img: ({ src, alt, class: _, ...rest }: any) => {
    if (src) {
      try {
        const u = new URL(src);
        if (u.hostname === ALLOWED_IMAGE_HOST) {
          return <img src={src} alt={alt} loading="lazy" {...rest} />;
        }
      } catch {}
    }
    return null;
  },
  a: ({ href, children, class: _, ...rest }: any) => {
    if (!href) return <>{children}</>;
    let needsRedirect = false;
    try {
      const parsed = new URL(href);
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const isExternal = !!host && parsed.hostname !== host;
      needsRedirect = isExternal && !isTrustedHost(parsed.hostname);
    } catch {}
    if (needsRedirect) {
      return (
        <a
          href={`${REDIRECT_COMMENT}?url=${encodeURIComponent(href)}`}
          rel="nofollow ugc"
          {...rest}
        >
          {children}
        </a>
      );
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
};

function buildGravatarUrl(md5: string | null, conf: FrontendConf): string | undefined {
  if (!md5) return undefined;
  const g = conf.gravatar ?? {};
  const mirror = g.mirror ?? 'https://www.gravatar.com/avatar/';
  const params = g.params ?? 'd=identicon&s=80';
  return `${mirror.replace(/\/?$/, '/')}${md5}?${params}`;
}

interface EmoticonItem {
  key: string;
  val: string;
}

interface EmoticonGroup {
  name: string;
  type: string;
  items: EmoticonItem[];
}

function parseEmoticonVal(val: string): { text?: string; imgSrc?: string } {
  const imgMatch = val.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
  if (imgMatch) return { imgSrc: imgMatch[1] };
  return { text: val };
}

function CommentForm({
  onSubmit,
  onCancel,
  isReply = false,
  replyTo,
  loading = false,
  conf,
  captchaState,
}: {
  onSubmit: (data: FormData) => Promise<boolean>;
  onCancel?: () => void;
  isReply?: boolean;
  replyTo?: string;
  loading?: boolean;
  conf: FrontendConf;
  captchaState?: CaptchaState;
}) {
  const locked = !!captchaState;
  const [formData, setFormData] = useState<FormData>({
    nickname: '',
    email: '',
    website: '',
    content: '',
  });
  // 图片验证码状态
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [captchaVerifying, setCaptchaVerifying] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('artalk-form') || '{}');
      if (saved.nickname || saved.email || saved.website) {
        setFormData((prev) => ({
          nickname: saved.nickname || prev.nickname,
          email: saved.email || prev.email,
          website: saved.website || prev.website,
          content: prev.content,
        }));
      }
    } catch {}
  }, []);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [emoticonGroups, setEmoticonGroups] = useState<EmoticonGroup[]>([]);
  const [activeEmoticonTab, setActiveEmoticonTab] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const emoticonBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showEmoticons) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        emoticonBtnRef.current &&
        !emoticonBtnRef.current.contains(target)
      ) {
        setShowEmoticons(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoticons]);

  const url = conf.emoticons ?? DEFAULT_CONF.emoticons!;

  const normalizeEmoticonData = (data: any): EmoticonGroup[] => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data).map(([name, grp]: [string, any]) => ({
        name,
        type: grp?.type ?? 'image',
        items: (grp?.container ?? grp?.items ?? []).map((item: any) => ({
          key: item?.text ?? item?.key ?? '',
          val: item?.icon ?? item?.val ?? '',
        })),
      }));
    }
    return [];
  };

  const loadEmoticons = useCallback(async (fetchUrl: string): Promise<EmoticonGroup[]> => {
    const r = await fetch(fetchUrl);
    const data = await r.json();
    return normalizeEmoticonData(data);
  }, []);

  useEffect(() => {
    loadEmoticons(url)
      .then((data) => {
        setEmoticonGroups(data);
        if (data.length > 0) setActiveEmoticonTab(data[0].name);
      })
      .catch(() => {
        loadEmoticons('/owo.json')
          .then((data) => {
            setEmoticonGroups(data);
            if (data.length > 0) setActiveEmoticonTab(data[0].name);
          })
          .catch(() => {});
      });
  }, [url, loadEmoticons]);

  const activeGroup = emoticonGroups.find((g) => g.name === activeEmoticonTab);

  useEffect(() => {
    localStorage.setItem(
      'artalk-form',
      JSON.stringify({
        nickname: formData.nickname,
        email: formData.email,
        website: formData.website,
      }),
    );
  }, [formData.nickname, formData.email, formData.website]);

  const emoticonImgMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const grp of emoticonGroups) {
      for (const item of grp.items) {
        const { imgSrc } = parseEmoticonVal(item.val);
        if (imgSrc) map[item.key] = imgSrc;
      }
    }
    return map;
  }, [emoticonGroups]);

  const previewTransform = (raw: string) =>
    raw.replace(/:\[([^\]]+)\]/g, (_, key: string) => {
      const url = emoticonImgMap[key];
      return url ? `<img atk-emoticon="${key}" src="${url}">` : _;
    });

  const insertEmoticon = (item: EmoticonItem) => {
    const el = textareaRef.current;
    if (!el) return;
    const { text, imgSrc } = parseEmoticonVal(item.val);

    const insertText = imgSrc ? `:[${item.key}]` : (text ?? item.key);
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = formData.content.slice(0, start);
    const after = formData.content.slice(end);
    setFormData({ ...formData, content: before + insertText + after });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertText.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nickname.trim() || !formData.email.trim() || !formData.content.trim()) {
      showToast('请填写昵称、邮箱和评论内容', 2000, 'error');
      return;
    }
    const normalizedWebsite = formData.website.trim()
      ? formData.website.includes('://')
        ? formData.website.trim()
        : `https://${formData.website.trim()}`
      : '';
    const ok = await onSubmit({ ...formData, website: normalizedWebsite });
    if (ok) {
      setFormData((prev) => ({ ...prev, content: '' }));
      setShowPreview(false);
    }
  };

  return (
    <div className={isReply ? 'bg-muted/50 mt-4 ml-12 rounded-lg p-4' : ''}>
      {isReply && replyTo && (
        <div className="text-muted-foreground mb-4 text-sm">
          回复 <span className="text-foreground font-medium">{replyTo}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <input
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="昵称 *"
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            disabled={locked || loading}
            required
          />
          <input
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            type="email"
            placeholder="邮箱 *"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={locked || loading}
            required
          />
          <input
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            type="text"
            inputMode="url"
            placeholder="网站（可选）"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            disabled={locked || loading}
          />
        </div>

        <div>
          <textarea
            ref={textareaRef}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={(conf.placeholder || '写下你的评论... 支持 Markdown 语法 *').replace(
              /<br\s*\/?>/gi,
              '\n',
            )}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={4}
            disabled={locked || loading}
            required
          />
        </div>

        <div
          className={cn(
            'grid transition-all duration-300 ease-out',
            showPreview ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-border bg-muted/30 mt-4 rounded-lg border p-4">
              <div className="text-muted-foreground mb-2 text-sm font-medium">预览</div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {formData.content ? (
                  safeMarkdownRender(previewTransform(formData.content))
                ) : (
                  <p className="text-muted-foreground">暂无内容</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              ref={emoticonBtnRef}
              onClick={() => {
                if (!locked) setShowEmoticons(!showEmoticons);
              }}
              disabled={locked || loading}
              className={showEmoticons ? 'text-primary' : ''}
            >
              <Smile className="h-5 w-5" />
            </Button>

            {}
            <div
              ref={pickerRef}
              className={cn(
                'bg-popover border-border absolute bottom-full left-0 z-50 mb-2 flex w-80 origin-bottom-left flex-col overflow-hidden rounded-xl border text-sm shadow-xl transition-all duration-200 ease-out select-none',
                showEmoticons && emoticonGroups.length > 0
                  ? 'scale-100 opacity-100'
                  : 'pointer-events-none invisible scale-95 opacity-0',
              )}
            >
              <nav className="border-border bg-background flex [scrollbar-width:none] items-center overflow-x-auto border-b px-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {emoticonGroups.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => setActiveEmoticonTab(g.name)}
                    className={cn(
                      'relative flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors',
                      activeEmoticonTab === g.name
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {g.name}
                    <span
                      className={cn(
                        'bg-primary absolute right-0 bottom-0 left-0 h-0.5 rounded-full transition-opacity duration-200',
                        activeEmoticonTab === g.name ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </button>
                ))}
              </nav>
              <div className="bg-background/50 h-52 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto p-2">
                {activeGroup && (
                  <div
                    key={activeEmoticonTab}
                    className="grid animate-[fade-in_150ms_ease-out] grid-cols-8 gap-1"
                  >
                    {activeGroup.items.map((item) => {
                      const { text, imgSrc } = parseEmoticonVal(item.val);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            insertEmoticon(item);
                            setShowEmoticons(false);
                          }}
                          title={item.key}
                          className="hover:bg-accent flex aspect-square items-center justify-center rounded-md transition-colors active:scale-90"
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={item.key}
                              loading="lazy"
                              className="h-7 w-7 object-contain"
                            />
                          ) : (
                            <span className="text-xs leading-none">{text}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-muted-foreground bg-muted/10 border-border/50 flex justify-between border-t px-3 py-1 text-[10px] tracking-tighter uppercase">
                <span>{activeEmoticonTab}</span>
                <span>{activeGroup?.items.length ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                取消
              </Button>
            )}
            {conf.preview !== false && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                disabled={locked || loading}
              >
                {showPreview ? '编辑' : '预览'}
              </Button>
            )}
            <Button type="submit" disabled={locked || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {conf.sendBtn || '发表评论'}
            </Button>
          </div>
        </div>

        {}
        {captchaState && (
          <div className="mt-2 flex justify-end">
            {captchaState.type === 'iframe' ? (
              <iframe
                src={captchaState.url}
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-[78px] w-[300px] border-0"
                title="Captcha"
              />
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <img
                    src={captchaState.imgData}
                    alt="验证码"
                    className="h-9 w-[120px] cursor-pointer rounded border object-contain"
                    onClick={() => captchaState.onRefresh()}
                    title="点击刷新验证码"
                  />
                  <input
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-28 rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="验证码"
                    value={captchaCode}
                    onChange={(e) => {
                      setCaptchaCode(e.target.value);
                      setCaptchaError('');
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setCaptchaVerifying(true);
                        setCaptchaError('');
                        try {
                          await captchaState.onVerify(captchaCode.trim());
                          setCaptchaCode('');
                        } catch {
                          setCaptchaError('验证码错误');
                          setCaptchaCode('');
                          await captchaState.onRefresh();
                        } finally {
                          setCaptchaVerifying(false);
                        }
                      }
                    }}
                    disabled={captchaVerifying}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={captchaVerifying || !captchaCode.trim()}
                    onClick={async () => {
                      setCaptchaVerifying(true);
                      setCaptchaError('');
                      try {
                        await captchaState.onVerify(captchaCode.trim());
                        setCaptchaCode('');
                      } catch {
                        setCaptchaError('验证码错误');
                        setCaptchaCode('');
                        await captchaState.onRefresh();
                      } finally {
                        setCaptchaVerifying(false);
                      }
                    }}
                  >
                    {captchaVerifying && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    验证
                  </Button>
                </div>
                {captchaError && <p className="text-destructive mt-1 text-xs">{captchaError}</p>}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function CommentItemComponent({
  comment,
  isReply = false,
  onReply,
  replyingTo,
  onSubmitReply,
  onCancelReply,
  loading,
  conf,
  captchaState,
}: {
  comment: NestedComment;
  isReply?: boolean;
  onReply: (id: number | null) => void;
  replyingTo: number | null;
  onSubmitReply: (parentId: number, data: FormData) => Promise<boolean>;
  onCancelReply: () => void;
  loading: boolean;
  conf: FrontendConf;
  captchaState?: CaptchaState;
}) {
  const ua = parseUa(comment.ua);
  const OSIcon = ua.os ? OS_ICONS[ua.os] : null;
  return (
    <div id={`atk-comment-${comment.id}`}>
      <div className={cn('flex gap-3', isReply ? 'py-3' : 'py-4')}>
        {}
        <div
          className={cn(
            'relative flex shrink-0 overflow-hidden rounded-full',
            isReply ? 'size-8' : 'size-10',
          )}
        >
          {comment.emailMd5 ? (
            <img
              className="aspect-square size-full"
              src={buildGravatarUrl(comment.emailMd5, conf)}
              alt={comment.nickname}
            />
          ) : (
            <span className="bg-primary/10 text-primary flex size-full items-center justify-center rounded-full text-xs font-medium">
              {comment.nickname.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {comment.website ? (
              (() => {
                const safe = safeUrl(comment.website);
                let needsRedirect = false;
                if (safe) {
                  try {
                    needsRedirect = !isTrustedHost(new URL(safe).hostname);
                  } catch {}
                }
                return (
                  <a
                    href={
                      safe
                        ? needsRedirect
                          ? `${REDIRECT_COMMENT}?url=${encodeURIComponent(safe)}`
                          : safe
                        : undefined
                    }
                    target={needsRedirect ? undefined : '_blank'}
                    rel="noopener noreferrer nofollow ugc"
                    className={cn(
                      'hover:text-primary font-semibold transition-colors',
                      isReply && 'text-sm',
                    )}
                  >
                    {comment.nickname}
                  </a>
                );
              })()
            ) : (
              <span className={cn('font-semibold', isReply && 'text-sm')}>{comment.nickname}</span>
            )}
            {comment.isAdmin && (
              <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">博主</span>
            )}
            <span className="text-muted-foreground relative top-[1px] text-xs">
              {formatTime(comment.createdAt)}
            </span>
            {comment.status === 'pending' && (
              <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-500">
                审核中
              </span>
            )}
          </div>

          <div
            className={cn(
              'text-foreground prose prose-sm dark:prose-invert mt-1 max-w-none',
              '[&>p]:my-0.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0',
              isReply && 'text-sm',
            )}
          >
            {comment.replyToNick && (
              <span className="text-muted-foreground">回复 @{comment.replyToNick}：</span>
            )}
            {safeMarkdownRender(comment.content)}
          </div>

          <div className="mt-1 flex items-center justify-between">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              {comment.ipRegion && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {comment.ipRegion}
                </span>
              )}
              {ua.os && OSIcon && (
                <span className="inline-flex items-center gap-0.5">
                  <OSIcon className="h-3 w-3" />
                  {ua.os}
                </span>
              )}
              {ua.browser && (
                <span className="inline-flex items-center gap-0.5">
                  <Globe className="h-3 w-3" />
                  {ua.browser}
                </span>
              )}
            </div>
            <button
              onClick={() => onReply(comment.id === replyingTo ? null : comment.id)}
              className="text-muted-foreground hover:text-primary flex shrink-0 items-center gap-1 text-sm transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>回复</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          replyingTo === comment.id
            ? 'grid-rows-[1fr] opacity-100'
            : 'pointer-events-none grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0">
          <CommentForm
            key={`reply-${comment.id}-${replyingTo === comment.id}`}
            onSubmit={(data) => onSubmitReply(comment.id, data)}
            onCancel={onCancelReply}
            isReply
            replyTo={comment.nickname}
            loading={loading}
            conf={conf}
            captchaState={captchaState?.target === comment.id ? captchaState : null}
          />
        </div>
      </div>
    </div>
  );
}

function ReplySection({
  replies,
  onReply,
  replyingTo,
  onSubmitReply,
  onCancelReply,
  loading,
  conf,
  captchaState,
}: {
  replies: NestedComment[];
  onReply: (id: number | null) => void;
  replyingTo: number | null;
  onSubmitReply: (parentId: number, data: FormData) => Promise<boolean>;
  onCancelReply: () => void;
  loading: boolean;
  conf: FrontendConf;
  captchaState?: CaptchaState;
}) {
  const [expanded, setExpanded] = useState(false);
  if (replies.length === 0) return null;

  const COLLAPSE_THRESHOLD = 2;
  const alwaysVisible = replies.slice(0, COLLAPSE_THRESHOLD);
  const hiddenReplies = replies.slice(COLLAPSE_THRESHOLD);

  return (
    <div className="mt-2 ml-12 space-y-2">
      {alwaysVisible.map((r) => (
        <CommentItemComponent
          key={r.id}
          comment={r}
          isReply
          onReply={onReply}
          replyingTo={replyingTo}
          onSubmitReply={onSubmitReply}
          onCancelReply={onCancelReply}
          loading={loading}
          conf={conf}
          captchaState={captchaState}
        />
      ))}
      {hiddenReplies.length > 0 && (
        <>
          <div
            className={cn(
              'grid transition-all duration-300 ease-out',
              expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="space-y-2 overflow-hidden">
              {hiddenReplies.map((r) => (
                <CommentItemComponent
                  key={r.id}
                  comment={r}
                  isReply
                  onReply={onReply}
                  replyingTo={replyingTo}
                  onSubmitReply={onSubmitReply}
                  onCancelReply={onCancelReply}
                  loading={loading}
                  conf={conf}
                  captchaState={captchaState}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-primary flex items-center gap-1 py-1 text-sm hover:underline"
          >
            {expanded ? '收起' : `展开 ${hiddenReplies.length} 条回复`}
          </button>
        </>
      )}
    </div>
  );
}

export default function CommentSystem({ path }: { path: string }) {
  const [client] = useState(() => new ArtalkClient(artalkConfig));
  const [conf, setConf] = useState<FrontendConf>(DEFAULT_CONF);
  const emoticonKey2Url = useRef<Record<string, string>>({});
  const [comments, setComments] = useState<NestedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [topFormKey, setTopFormKey] = useState(0);
  const [captchaState, setCaptchaState] = useState<CaptchaState>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLoginErr, setAdminLoginErr] = useState('');
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [adminCaptcha, setAdminCaptcha] = useState<
    { type: 'image'; imgData: string } | { type: 'iframe'; url: string } | null
  >(null);
  const [adminCaptchaCode, setAdminCaptchaCode] = useState('');
  const [adminCaptchaError, setAdminCaptchaError] = useState('');
  const [adminCaptchaLoading, setAdminCaptchaLoading] = useState(false);
  const pendingSubmit = useRef<(() => Promise<boolean>) | null>(null);

  useEffect(() => {
    getConf(client)
      .then((res) => {
        const fc = res.frontend_conf as Record<string, unknown>;
        setConf({
          emoticons: typeof fc.emoticons === 'string' ? fc.emoticons : DEFAULT_CONF.emoticons,
          gravatar:
            ((typeof fc.gravatar === 'object' ? fc.gravatar : null) as FrontendConf['gravatar']) ??
            DEFAULT_CONF.gravatar,
          pagination:
            ((typeof fc.pagination === 'object'
              ? fc.pagination
              : null) as FrontendConf['pagination']) ?? DEFAULT_CONF.pagination,
          noComment: typeof fc.noComment === 'string' ? fc.noComment : DEFAULT_CONF.noComment,
          placeholder:
            typeof fc.placeholder === 'string' ? fc.placeholder : DEFAULT_CONF.placeholder,
          sendBtn: typeof fc.sendBtn === 'string' ? fc.sendBtn : DEFAULT_CONF.sendBtn,
          preview: typeof fc.preview === 'boolean' ? fc.preview : DEFAULT_CONF.preview,
        });
      })
      .catch((e) => {
        console.warn('[CommentSystem] /conf FAIL:', e);
      });
  }, [client]);

  useEffect(() => {
    const url = conf.emoticons ?? DEFAULT_CONF.emoticons!;

    const buildMap = (data: any) => {
      const map: Record<string, string> = {};
      const groups = Array.isArray(data) ? data : Object.values(data);
      for (const grp of groups) {
        const items = grp?.items ?? grp?.container ?? [];
        for (const item of items) {
          const key = item?.key ?? item?.text ?? '';
          const val = item?.val ?? item?.icon ?? '';
          if (!key) continue;
          let imgUrl = '';
          if (val.startsWith('http')) imgUrl = val;
          else {
            const m = val.match(/src=['"]([^'"]+)['"]/);
            if (m) imgUrl = m[1];
          }
          if (imgUrl) map[key] = imgUrl;
        }
      }
      emoticonKey2Url.current = map;
    };

    fetch(url)
      .then((r) => r.json())
      .then(buildMap)
      .catch(() => {
        fetch('/owo.json')
          .then((r) => r.json())
          .then(buildMap)
          .catch(() => {});
      });
  }, [conf.emoticons]);

  const transformContent = useCallback((raw: string): string => {
    const map = emoticonKey2Url.current;
    return raw.replace(/:\[([^\]]+)\]/g, (_, key: string) => {
      const url = map[key];
      return url ? `<img atk-emoticon="${key}" src="${url}">` : _;
    });
  }, []);

  const handleAdminLogin = async () => {
    try {
      const res = await adminLogin(client, adminForm);
      client.setToken(res.token);
      localStorage.setItem('artalk-admin-token', res.token);
      setShowAdminLogin(false);
      setAdminLoginErr('');
      setAdminCaptcha(null);
      showToast('登录成功', 2000, 'success');
      pendingSubmit.current?.();
      pendingSubmit.current = null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      if (msg.includes('验证码') || msg.includes('captcha')) {
        try {
          const captchaRes = await getCaptcha(client);
          if (captchaRes.img_data) {
            setAdminCaptcha({ type: 'image', imgData: captchaRes.img_data });
            return;
          }
        } catch {}
        setAdminCaptcha({ type: 'iframe', url: client.getCaptchaUrl() });
        return;
      }
      setAdminLoginErr(msg);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('artalk-admin-token');
    if (saved) client.setToken(saved);
  }, [client]);

  const closeAdminLogin = () => {
    setShowAdminLogin(false);
    setSubmitting(false);
    setAdminCaptcha(null);
    setAdminCaptchaCode('');
    setAdminCaptchaError('');
    pendingSubmit.current = null;
  };

  const pageSize = conf.pagination?.pageSize ?? 20;

  const loadComments = useCallback(
    async (cursor?: number) => {
      try {
        setLoading(true);
        setError(null);
        let userName: string | undefined;
        let userEmail: string | undefined;
        try {
          const saved = JSON.parse(localStorage.getItem('artalk-form') || '{}');
          userName = saved.nickname || undefined;
          userEmail = saved.email || undefined;
        } catch {}
        const res = await fetchComments(client, path, cursor, pageSize, userName, userEmail);
        const tree = buildCommentTree(res.data);
        if (cursor) {
          setComments((prev) => [...prev, ...tree]);
        } else {
          setComments(tree);
        }
        setNextCursor(res.nextCursor);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '加载评论失败';
        console.error('[CommentSystem] loadComments FAIL:', msg, err);
        setError(msg);
        showToast(msg, 3000, 'error');
      } finally {
        setLoading(false);
      }
    },
    [client, path],
  );

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!nextCursor || !conf.pagination?.readMore !== false) return;
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadComments(nextCursor);
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, conf.pagination?.readMore, loadComments]);

  useEffect(() => {
    const isIframeCaptcha = captchaState?.type === 'iframe';
    const isAdminIframe = adminCaptcha?.type === 'iframe';
    if (!isIframeCaptcha && !isAdminIframe) return;
    const interval = setInterval(async () => {
      try {
        const res = await getCaptchaStatus(client);
        if (res.is_pass) {
          if (isIframeCaptcha && captchaState?.type === 'iframe') {
            captchaState.onVerified();
          } else if (isAdminIframe) {
            setAdminCaptcha(null);
            handleAdminLogin();
          }
        }
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [captchaState, adminCaptcha, client]);

  const totalComments = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  /** 获取验证码类型并设置状态，优先图片，回退 iframe */
  const setupCaptcha = useCallback(
    async (target: 'top' | number) => {
      try {
        const res = await getCaptcha(client);
        if (res.img_data) {
          setCaptchaState({
            type: 'image',
            imgData: res.img_data,
            target,
            onVerify: async (code: string) => {
              await verifyCaptcha(client, { value: code });
              setCaptchaState(null);
              pendingSubmit.current?.();
              pendingSubmit.current = null;
            },
            onRefresh: async () => {
              const fresh = await getCaptcha(client);
              setCaptchaState((prev) =>
                prev?.type === 'image' ? { ...prev, imgData: fresh.img_data } : prev,
              );
            },
            onCancel: () => {
              setCaptchaState(null);
              pendingSubmit.current = null;
              setSubmitting(false);
            },
          });
          return;
        }
      } catch {}
      // 回退到 iframe
      setCaptchaState({
        type: 'iframe',
        url: client.getCaptchaUrl(),
        target,
        onVerified: () => {
          setCaptchaState(null);
          pendingSubmit.current?.();
          pendingSubmit.current = null;
        },
        onCancel: () => {
          setCaptchaState(null);
          pendingSubmit.current = null;
          setSubmitting(false);
        },
      });
    },
    [client],
  );

  const handleSubmitComment = async (data: FormData): Promise<boolean> => {
    const doSubmit = async () => {
      setSubmitting(true);
      try {
        await postComment(client, {
          path,
          nickname: data.nickname,
          email: data.email,
          website: data.website || undefined,
          content: transformContent(data.content),
          ua: navigator.userAgent,
          pageTitle: document.title,
        });
        showToast('评论发表成功！', 2000, 'success');
        await loadComments();
        setSubmitting(false);
        setTopFormKey((k) => k + 1);
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '发表评论失败';
        if (msg.includes('验证码') || msg.includes('captcha')) {
          pendingSubmit.current = doSubmit;
          await setupCaptcha('top');
          return false;
        }
        if (msg.includes('管理员') || msg.includes('admin')) {
          pendingSubmit.current = doSubmit;
          setShowAdminLogin(true);
          return false;
        }
        showToast(msg, 3000, 'error');
        setSubmitting(false);
        return false;
      }
    };
    return await doSubmit();
  };

  const handleSubmitReply = async (parentId: number, data: FormData): Promise<boolean> => {
    const doSubmit = async () => {
      setSubmitting(true);
      try {
        await postComment(client, {
          path,
          nickname: data.nickname,
          email: data.email,
          website: data.website || undefined,
          content: transformContent(data.content),
          parentId,
          ua: navigator.userAgent,
          pageTitle: document.title,
        });
        setReplyingTo(null);
        showToast('回复发表成功！', 2000, 'success');
        await loadComments();
        setSubmitting(false);
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '发表回复失败';
        if (msg.includes('验证码') || msg.includes('captcha')) {
          pendingSubmit.current = doSubmit;
          await setupCaptcha(parentId);
          return false;
        }
        if (msg.includes('管理员') || msg.includes('admin')) {
          pendingSubmit.current = doSubmit;
          setShowAdminLogin(true);
          return false;
        }
        showToast(msg, 3000, 'error');
        setSubmitting(false);
        return false;
      }
    };
    return await doSubmit();
  };

  return (
    <div className="w-full" suppressHydrationWarning>
      <CommentForm
        key={topFormKey}
        onSubmit={handleSubmitComment}
        loading={submitting}
        conf={conf}
        captchaState={captchaState?.target === 'top' ? captchaState : null}
      />

      <div className="mt-6" />

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          评论 <span className="text-muted-foreground">({totalComments})</span>
        </h3>
      </div>

      {error && <div className="text-destructive py-8 text-center">{error}</div>}

      {loading && comments.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      )}

      {!loading && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment, index) => (
            <div key={comment.id}>
              <CommentItemComponent
                comment={comment}
                onReply={setReplyingTo}
                replyingTo={replyingTo}
                onSubmitReply={handleSubmitReply}
                onCancelReply={() => setReplyingTo(null)}
                loading={submitting}
                conf={conf}
                captchaState={captchaState}
              />
              <ReplySection
                replies={comment.replies}
                onReply={setReplyingTo}
                replyingTo={replyingTo}
                onSubmitReply={handleSubmitReply}
                onCancelReply={() => setReplyingTo(null)}
                loading={submitting}
                conf={conf}
                captchaState={captchaState}
              />
              {index < comments.length - 1 && <div className="mb-1" />}
            </div>
          ))}
        </div>
      )}

      {conf.pagination?.readMore !== false && nextCursor && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
      )}

      {!loading && comments.length === 0 && !error && (
        <div className="text-muted-foreground py-12 text-center">
          {conf.noComment || '暂无评论，来抢沙发吧～'}
        </div>
      )}

      {}
      {showAdminLogin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={closeAdminLogin}
        >
          <div
            className="bg-background w-[360px] rounded-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold">管理员登录</h3>
            <div className="space-y-3">
              <input
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
                type="email"
                placeholder="邮箱"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
              <input
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
                type="password"
                placeholder="密码"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
              {adminLoginErr && <p className="text-destructive text-sm">{adminLoginErr}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeAdminLogin}>
                  取消
                </Button>
                <Button onClick={handleAdminLogin}>登录</Button>
              </div>
              {adminCaptcha && (
                <div className="mt-3 flex flex-col gap-2">
                  {adminCaptcha.type === 'iframe' ? (
                    <div className="flex justify-end">
                      <iframe
                        src={adminCaptcha.url}
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="h-[78px] w-[300px] border-0"
                        title="Captcha"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <img
                          src={adminCaptcha.imgData}
                          alt="验证码"
                          className="h-9 w-[120px] cursor-pointer rounded border object-contain"
                          onClick={async () => {
                            try {
                              const res = await getCaptcha(client);
                              if (res.img_data)
                                setAdminCaptcha({ type: 'image', imgData: res.img_data });
                            } catch {}
                          }}
                          title="点击刷新验证码"
                        />
                        <input
                          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-28 rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          placeholder="验证码"
                          value={adminCaptchaCode}
                          onChange={(e) => {
                            setAdminCaptchaCode(e.target.value);
                            setAdminCaptchaError('');
                          }}
                          disabled={adminCaptchaLoading}
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={adminCaptchaLoading || !adminCaptchaCode.trim()}
                          onClick={async () => {
                            setAdminCaptchaLoading(true);
                            setAdminCaptchaError('');
                            try {
                              await verifyCaptcha(client, { value: adminCaptchaCode.trim() });
                              setAdminCaptcha(null);
                              setAdminCaptchaCode('');
                              await handleAdminLogin();
                            } catch {
                              setAdminCaptchaError('验证码错误');
                              setAdminCaptchaCode('');
                              try {
                                const res = await getCaptcha(client);
                                if (res.img_data)
                                  setAdminCaptcha({ type: 'image', imgData: res.img_data });
                              } catch {}
                            } finally {
                              setAdminCaptchaLoading(false);
                            }
                          }}
                        >
                          {adminCaptchaLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          验证
                        </Button>
                      </div>
                      {adminCaptchaError && (
                        <p className="text-destructive mt-1 text-xs">{adminCaptchaError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
