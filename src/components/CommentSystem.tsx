import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Smile } from 'lucide-react';
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
import { getCaptchaStatus } from '@/lib/artalk/captcha';
import { login as adminLogin } from '@/lib/artalk/user';
import { artalkConfig } from '@/config/artalk';

// ---- 类型 ----

interface FormData {
  nickname: string;
  email: string;
  website: string;
  content: string;
}

interface NestedComment extends CommentItem {
  replies: NestedComment[];
  /** 若本条是对某条回复的回复（非直接回复顶层），记录被回复者的昵称 */
  replyToNick?: string;
}

// ---- 工具函数 ----

/** 构建评论树，最多嵌套1层——所有回复平铺到顶层评论下 */
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
        // 直接回复顶层 → 挂在顶层下
        parent.replies.push(node);
      } else {
        // 回复的是某条回复 → 找到顶层祖先，平铺并标记 @xxx
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
  // 按时间倒序排列根评论（最新在前），每个根评论下的回复按时间正序
  for (const root of roots) {
    root.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return roots;
}

function formatTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}天前`;
  if (h > 0) return `${h}小时前`;
  if (m > 0) return `${m}分钟前`;
  return '刚刚';
}

// ---- 后端配置 ----

/** Artalk /conf → frontend_conf 中本组件使用的字段 */
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
  pagination: { pageSize: 20, readMore: true, autoLoad: false },
  noComment: '',
  placeholder: '',
  sendBtn: '',
  preview: true,
};

/**
 * 清洗评论内容 HTML（对齐 Artalk 官方 insane 配置），用于 rehype-raw 渲染前
 */
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

/** ReactMarkdown + rehype-raw 渲染前清洗，防止 XSS */
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

/** 允许的 URL 协议白名单 */
const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:'];

/** 校验并清洗用户提供的 URL，阻断 javascript: / data: 等危险协议 */
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

/**
 * 清洗 HTML 字符串，移除危险属性和事件处理器
 * 使用 insane（Artalk 官方同款 sanitizer，兼容 SSR）
 */
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

/**
 * ReactMarkdown 自定义组件：
 * - 非 ordchaos.com 图片 → 屏蔽并显示占位文字
 * - 外部链接 → 经 /redirect-comment 中转
 */
const ALLOWED_IMAGE_HOST = 'www.ordchaos.com';
const REDIRECT_COMMENT = '/redirect-comment/';

const MARKDOWN_COMPONENTS = {
  img: ({ src, alt, class: _, ...rest }: any) => {
    if (src) {
      try {
        const u = new URL(src);
        if (u.hostname === ALLOWED_IMAGE_HOST) {
          return <img src={src} alt={alt} loading="lazy" {...rest} />;
        }
      } catch {
        /* invalid URL, block */
      }
    }
    return null;
  },
  a: ({ href, children, class: _, ...rest }: any) => {
    if (!href) return <>{children}</>;
    let isExternal = false;
    try {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      isExternal = !!host && new URL(href).hostname !== host;
    } catch {
      /* invalid URL, pass through as-is */
    }
    if (isExternal) {
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

// ---- 工具函数 ----

function buildGravatarUrl(md5: string | null, conf: FrontendConf): string | undefined {
  if (!md5) return undefined;
  const g = conf.gravatar ?? {};
  const mirror = g.mirror ?? 'https://www.gravatar.com/avatar/';
  const params = g.params ?? 'd=identicon&s=80';
  return `${mirror.replace(/\/?$/, '/')}${md5}?${params}`;
}

// ---- 表情包 ----

interface EmoticonItem {
  key: string;
  val: string;
}

interface EmoticonGroup {
  name: string;
  type: string;
  items: EmoticonItem[];
}

/** 解析 val 字段：纯文本直接返回，<img> 提取 src */
function parseEmoticonVal(val: string): { text?: string; imgSrc?: string } {
  const imgMatch = val.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
  if (imgMatch) return { imgSrc: imgMatch[1] };
  return { text: val };
}

// ---- 评论表单 ----

function CommentForm({
  onSubmit,
  onCancel,
  isReply = false,
  replyTo,
  loading = false,
  conf,
  captchaState,
}: {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel?: () => void;
  isReply?: boolean;
  replyTo?: string;
  loading?: boolean;
  conf: FrontendConf;
  captchaState?: { url: string; onVerified: () => void; onCancel: () => void } | null;
}) {
  const locked = !!captchaState;
  const [formData, setFormData] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem('artalk-form');
      if (saved) return { nickname: '', email: '', website: '', content: '', ...JSON.parse(saved) };
    } catch {}
    return { nickname: '', email: '', website: '', content: '' };
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [emoticonGroups, setEmoticonGroups] = useState<EmoticonGroup[]>([]);
  const [activeEmoticonTab, setActiveEmoticonTab] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 点击表情选择器外部时自动关闭
  useEffect(() => {
    if (!showEmoticons) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmoticons(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoticons]);

  const url = conf.emoticons ?? DEFAULT_CONF.emoticons!;

  // 将 OwO 对象格式转为 Artalk 数组格式
  const normalizeEmoticonData = (data: any): EmoticonGroup[] => {
    if (Array.isArray(data)) return data;
    // OwO 格式: { "groupName": { type, container: [{ icon, text }] } }
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

  // 加载表情包（用于表情选择器 UI）
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
        // 远程加载失败，fallback 到本地 owo.json
        loadEmoticons('/owo.json')
          .then((data) => {
            setEmoticonGroups(data);
            if (data.length > 0) setActiveEmoticonTab(data[0].name);
          })
          .catch(() => {});
      });
  }, [url, loadEmoticons]);

  const activeGroup = emoticonGroups.find((g) => g.name === activeEmoticonTab);

  // 持久化昵称/邮箱/网址到 localStorage
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

  // 构建 key→url 映射（用于预览中 :[key] → 图片）
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

  // 预览用：:[key] → ![key](url) Markdown 图片语法
  const previewTransform = (raw: string) =>
    raw.replace(/:\[([^\]]+)\]/g, (_, key: string) => {
      const url = emoticonImgMap[key];
      return url ? `![${key}](${url})` : _;
    });

  // 插入表情到光标位置
  const insertEmoticon = (item: EmoticonItem) => {
    const el = textareaRef.current;
    if (!el) return;
    const { text, imgSrc } = parseEmoticonVal(item.val);
    // 对齐官方：图片表情插入 :[key]，文字表情插入原文
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
    try {
      await onSubmit(formData);
    } catch {
      // 提交失败（验证码/权限等），父组件已 toast，不清理内容
      return;
    }
    // 仅成功时清空
    setFormData((prev) => ({ ...prev, content: '' }));
    setShowPreview(false);
  };

  return (
    <div className={isReply ? 'bg-muted/50 mt-4 ml-12 rounded-lg p-4' : ''}>
      {!isReply && <h3 className="mb-4 text-lg font-semibold">发表评论</h3>}
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
            type="url"
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
            placeholder={conf.placeholder || '写下你的评论... 支持 Markdown 语法 *'}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={4}
            disabled={locked || loading}
            required
          />
        </div>

        {showPreview && (
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
        )}

        <div className="flex items-center justify-between">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!locked) setShowEmoticons(!showEmoticons);
              }}
              disabled={locked || loading}
              className={showEmoticons ? 'text-primary' : ''}
            >
              <Smile className="h-4 w-4" />
            </Button>

            {/* 表情选择器 popover */}
            <div
              ref={pickerRef}
              className={`bg-popover border-border absolute bottom-full left-0 z-50 mb-2 flex w-80 origin-bottom-left flex-col overflow-hidden rounded-xl border text-sm shadow-xl transition-all duration-200 ease-out select-none ${
                showEmoticons && emoticonGroups.length > 0
                  ? 'scale-100 opacity-100'
                  : 'pointer-events-none invisible scale-95 opacity-0'
              }`}
            >
              <nav className="border-border bg-background flex [scrollbar-width:none] items-center overflow-x-auto border-b px-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {emoticonGroups.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => setActiveEmoticonTab(g.name)}
                    className={`relative flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
                      activeEmoticonTab === g.name
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {g.name}
                    {activeEmoticonTab === g.name && (
                      <span className="bg-primary absolute right-0 bottom-0 left-0 h-0.5 rounded-full" />
                    )}
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

        {/* 验证码内联显示 */}
        {captchaState && (
          <iframe
            src={captchaState.url}
            referrerPolicy="strict-origin-when-cross-origin"
            className="mt-4 h-[420px] w-full border-0"
            title="Captcha"
          />
        )}
      </form>
    </div>
  );
}

// ---- 单条评论 ----

function CommentItemComponent({
  comment,
  isReply = false,
  onReply,
  replyingTo,
  onSubmitReply,
  onCancelReply,
  loading,
  conf,
}: {
  comment: NestedComment;
  isReply?: boolean;
  onReply: (id: number) => void;
  replyingTo: number | null;
  onSubmitReply: (parentId: number, data: FormData) => Promise<void>;
  onCancelReply: () => void;
  loading: boolean;
  conf: FrontendConf;
}) {
  return (
    <div>
      <div className={`flex gap-3 ${isReply ? 'py-3' : 'py-4'}`}>
        {/* 纯 HTML Avatar，替代 shadcn Avatar */}
        <div
          className={`relative flex shrink-0 overflow-hidden rounded-full ${isReply ? 'size-8' : 'size-10'}`}
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
              <a
                href={safeUrl(comment.website)}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className={`hover:text-primary font-medium transition-colors ${isReply ? 'text-sm' : ''}`}
              >
                {comment.nickname}
              </a>
            ) : (
              <span className={`font-medium ${isReply ? 'text-sm' : ''}`}>{comment.nickname}</span>
            )}
            {comment.isAdmin && (
              <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">博主</span>
            )}
            <span className="text-muted-foreground text-xs">{formatTime(comment.createdAt)}</span>
            {comment.status === 'pending' && (
              <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-500">
                审核中
              </span>
            )}
          </div>

          <div
            className={`text-foreground prose prose-sm dark:prose-invert mt-2 max-w-none ${isReply ? 'text-sm' : ''}`}
          >
            {comment.replyToNick && (
              <span className="text-muted-foreground">回复 @{comment.replyToNick}：</span>
            )}
            {safeMarkdownRender(comment.content)}
          </div>

          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => onReply(comment.id)}
              className="text-muted-foreground hover:text-primary flex items-center gap-1 text-sm transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>回复</span>
            </button>
          </div>
        </div>
      </div>

      {replyingTo === comment.id && (
        <CommentForm
          onSubmit={(data) => onSubmitReply(comment.id, data)}
          onCancel={onCancelReply}
          isReply
          replyTo={comment.nickname}
          loading={loading}
          conf={conf}
        />
      )}
    </div>
  );
}

// ---- 回复区域（超过2条折叠） ----

function ReplySection({
  replies,
  onReply,
  replyingTo,
  onSubmitReply,
  onCancelReply,
  loading,
  conf,
}: {
  replies: NestedComment[];
  onReply: (id: number) => void;
  replyingTo: number | null;
  onSubmitReply: (parentId: number, data: FormData) => Promise<void>;
  onCancelReply: () => void;
  loading: boolean;
  conf: FrontendConf;
}) {
  const [expanded, setExpanded] = useState(false);
  if (replies.length === 0) return null;

  const COLLAPSE_THRESHOLD = 2;
  const displayed = expanded ? replies : replies.slice(0, COLLAPSE_THRESHOLD);
  const hidden = replies.length - COLLAPSE_THRESHOLD;

  return (
    <div className="border-border mt-2 ml-12 space-y-2 border-l-2 pl-4">
      {displayed.map((r) => (
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
        />
      ))}
      {hidden > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary flex items-center gap-1 py-1 text-sm hover:underline"
        >
          {expanded ? '收起' : `展开 ${hidden} 条回复`}
        </button>
      )}
    </div>
  );
}

// ---- 主组件 ----

export default function CommentSystem({ path }: { path: string }) {
  const [client] = useState(() => new ArtalkClient(artalkConfig));
  const [conf, setConf] = useState<FrontendConf>(DEFAULT_CONF);
  /** 图片表情 key → URL 映射，用于提交前 :[key] → <img atk-emoticon> 转换 */
  const emoticonKey2Url = useRef<Record<string, string>>({});
  const [comments, setComments] = useState<NestedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topFormKey, setTopFormKey] = useState(0);
  const [captchaState, setCaptchaState] = useState<{
    url: string;
    onVerified: () => void;
    onCancel: () => void;
  } | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminLoginErr, setAdminLoginErr] = useState('');
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const pendingSubmit = useRef<(() => Promise<void>) | null>(null);

  // 拉取后端配置
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
      }); // 获取失败用默认值
  }, [client]);

  // 加载表情包 key→url 映射（用于提交前 :[key] → <img atk-emoticon> 转换）
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
        // CORS 阻止则 fallback 到本地
        fetch('/owo.json')
          .then((r) => r.json())
          .then(buildMap)
          .catch(() => {});
      });
  }, [conf.emoticons]);

  /** 对齐官方前端 Emoticons.transEmoticonImageText: :[key] → <img atk-emoticon> */
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
      showToast('登录成功', 2000, 'success');
      pendingSubmit.current?.();
      pendingSubmit.current = null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      setAdminLoginErr(msg);
    }
  };

  // 初始化时恢复已保存的 token
  useEffect(() => {
    const saved = localStorage.getItem('artalk-admin-token');
    if (saved) client.setToken(saved);
  }, [client]);

  const pageSize = conf.pagination?.pageSize ?? 20;

  const loadComments = useCallback(
    async (cursor?: number) => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchComments(client, path, cursor, pageSize);
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

  // 验证码 iframe 轮询：验证通过后自动提交
  useEffect(() => {
    if (!captchaState) return;
    const interval = setInterval(async () => {
      try {
        const res = await getCaptchaStatus(client);
        if (res.is_pass) {
          captchaState.onVerified();
        }
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [captchaState, client]);

  const totalComments = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  const handleSubmitComment = async (data: FormData) => {
    const doSubmit = async () => {
      setSubmitting(true);
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
    };
    try {
      await doSubmit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '发表评论失败';
      if (msg.includes('验证码') || msg.includes('captcha')) {
        pendingSubmit.current = doSubmit;
        setCaptchaState({
          url: client.getCaptchaUrl(),
          onVerified: () => {
            setCaptchaState(null);
            pendingSubmit.current?.();
            pendingSubmit.current = null;
          },
          onCancel: () => {
            setCaptchaState(null);
            pendingSubmit.current = null;
          },
        });
        throw err;
      }
      if (msg.includes('管理员') || msg.includes('admin')) {
        pendingSubmit.current = doSubmit;
        setShowAdminLogin(true);
        throw err;
      }
      showToast(msg, 3000, 'error');
      throw err;
    }
  };

  const handleSubmitReply = async (parentId: number, data: FormData) => {
    const doSubmit = async () => {
      setSubmitting(true);
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
    };
    try {
      await doSubmit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '发表回复失败';
      if (msg.includes('验证码') || msg.includes('captcha')) {
        pendingSubmit.current = doSubmit;
        setCaptchaState({
          url: client.getCaptchaUrl(),
          onVerified: () => {
            setCaptchaState(null);
            pendingSubmit.current?.();
            pendingSubmit.current = null;
          },
          onCancel: () => {
            setCaptchaState(null);
            pendingSubmit.current = null;
          },
        });
        throw err;
      }
      if (msg.includes('管理员') || msg.includes('admin')) {
        pendingSubmit.current = doSubmit;
        setShowAdminLogin(true);
        throw err;
      }
      showToast(msg, 3000, 'error');
      throw err;
    }
  };

  return (
    <div className="w-full">
      <CommentForm
        key={topFormKey}
        onSubmit={handleSubmitComment}
        loading={submitting}
        conf={conf}
        captchaState={captchaState}
      />

      <hr className="border-border my-8" />

      <div className="mb-6 flex items-center justify-between">
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
              />
              <ReplySection
                replies={comment.replies}
                onReply={setReplyingTo}
                replyingTo={replyingTo}
                onSubmitReply={handleSubmitReply}
                onCancelReply={() => setReplyingTo(null)}
                loading={submitting}
                conf={conf}
              />
              {index < comments.length - 1 && <hr className="border-border my-1" />}
            </div>
          ))}
        </div>
      )}

      {conf.pagination?.readMore !== false && nextCursor && !loading && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => loadComments(nextCursor)} disabled={loading}>
            加载更多
          </Button>
        </div>
      )}

      {!loading && comments.length === 0 && !error && (
        <div className="text-muted-foreground py-12 text-center">
          {conf.noComment || '暂无评论，来抢沙发吧～'}
        </div>
      )}

      {/* 管理员登录弹窗 */}
      {showAdminLogin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setShowAdminLogin(false)}
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
                <Button variant="outline" onClick={() => setShowAdminLogin(false)}>
                  取消
                </Button>
                <Button onClick={handleAdminLogin}>登录</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
