import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { List, X } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  depth: number;
}

interface TocNode {
  id: string;
  text: string;
  children: { id: string; text: string }[];
}

interface OffsetItem {
  id: string;
  top: number;
  parentId: string | null;
}

interface TocProps {
  headings: TocItem[];
}

export default function Toc({ headings }: TocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const headingOffsets = useRef<OffsetItem[]>([]);
  const isManualScrolling = useRef(false);
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toc = useMemo<TocNode[]>(() => {
    const nodes: TocNode[] = [];
    let lastH2: TocNode | null = null;

    for (const item of headings) {
      if (item.depth === 2) {
        lastH2 = { id: item.id, text: item.text, children: [] };
        nodes.push(lastH2);
      } else if (item.depth === 3 && lastH2) {
        lastH2.children.push({ id: item.id, text: item.text });
      }
    }

    return nodes;
  }, [headings]);

  const hasToc = toc.length > 0;

  const updateOffsets = useCallback(() => {
    if (isManualScrolling.current) return;
    const offsets: OffsetItem[] = [];

    for (const h2 of toc) {
      const el = document.getElementById(h2.id);
      if (el) {
        offsets.push({
          id: h2.id,
          top: el.getBoundingClientRect().top + window.pageYOffset,
          parentId: null,
        });
      }
      for (const h3 of h2.children) {
        const el3 = document.getElementById(h3.id);
        if (el3) {
          offsets.push({
            id: h3.id,
            top: el3.getBoundingClientRect().top + window.pageYOffset,
            parentId: h2.id,
          });
        }
      }
    }

    headingOffsets.current = offsets;
  }, [toc]);

  useEffect(() => {
    if (!hasToc) return;
    const article = document.getElementById('post-content');
    if (!article) return;

    const handleImgLoad = (e: Event) => {
      if ((e.target as HTMLElement).tagName === 'IMG') {
        requestAnimationFrame(updateOffsets);
      }
    };

    article.addEventListener('load', handleImgLoad, true);
    const timer = setTimeout(() => requestAnimationFrame(updateOffsets), 500);

    return () => {
      clearTimeout(timer);
      article.removeEventListener('load', handleImgLoad, true);
    };
  }, [hasToc, updateOffsets]);

  useEffect(() => {
    if (!hasToc) return;

    const onScroll = () => {
      if (!headingOffsets.current.length) return;
      const triggerPoint = window.scrollY + 100;
      let current: OffsetItem | null = null;

      for (const h of headingOffsets.current) {
        if (h.top <= triggerPoint) current = h;
        else break;
      }

      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }

      if (isManualScrolling.current) {
        if (current && current.id === activeId) {
          isManualScrolling.current = false;
        } else {
          scrollEndTimeoutRef.current = setTimeout(() => {
            scrollEndTimeoutRef.current = null;
            isManualScrolling.current = false;
            window.dispatchEvent(new Event('scroll'));
          }, 150);
          return;
        }
      }

      if (current && current.id !== activeId) {
        setActiveId(current.id);
        setExpandedId(current.parentId || current.id);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeId, hasToc]);

  const handleTocClick = (e: React.MouseEvent, targetId: string, parentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const element = document.getElementById(targetId);
    if (!element) return;

    isManualScrolling.current = true;
    setActiveId(targetId);
    setExpandedId(parentId || targetId);

    const targetTop = element.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  };

  if (!hasToc) return null;

  const renderTocList = () => (
    <ul className="space-y-1">
      {toc.map((h2) => (
        <li key={h2.id}>
          <a
            href={`#${h2.id}`}
            onClick={(e) => handleTocClick(e, h2.id, null)}
            className={`block border-l-2 py-1.5 pl-3 text-sm transition-all ${
              activeId === h2.id
                ? 'border-primary text-primary bg-primary/5 font-bold'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            {h2.text}
          </a>
          {expandedId === h2.id && h2.children.length > 0 && (
            <ul className="border-muted/20 mt-1 mb-2 ml-4 space-y-1 border-l">
              {h2.children.map((h3) => (
                <li key={h3.id}>
                  <a
                    href={`#${h3.id}`}
                    onClick={(e) => handleTocClick(e, h3.id, h2.id)}
                    className={`block border-l-2 py-1 pl-4 text-xs transition-colors ${
                      activeId === h3.id
                        ? 'border-primary text-primary font-medium'
                        : 'text-muted-foreground border-transparent'
                    }`}
                  >
                    {h3.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <aside className="hidden w-64 xl:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="border-border bg-card hover:border-primary/50 overflow-hidden rounded-lg border shadow-md transition-all duration-300 hover:shadow-lg">
            <div className="p-5">
              <div className="mb-4 text-sm font-bold">目录</div>
              <nav>{renderTocList()}</nav>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setMobileTocOpen(true)}
        className="toc-mobile-btn bg-card text-foreground border-border hover:border-primary/50 fixed right-6 bottom-6 z-50 rounded-lg border p-3 shadow-md transition-all duration-300 hover:shadow-lg active:scale-95 xl:hidden"
        aria-label="打开目录"
      >
        <List className="h-6 w-6" />
      </button>

      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 xl:hidden ${
          mobileTocOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileTocOpen(false)}
      />

      <div
        className={`bg-card border-border fixed top-0 right-0 z-[70] h-full w-72 max-w-[85vw] border-l shadow-2xl transition-transform duration-300 ease-out xl:hidden ${
          mobileTocOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="border-border flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-bold">目录</h3>
          <button
            onClick={() => setMobileTocOpen(false)}
            className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            aria-label="关闭目录"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 57px)' }}>
          {renderTocList()}
        </nav>
      </div>
    </>
  );
}
