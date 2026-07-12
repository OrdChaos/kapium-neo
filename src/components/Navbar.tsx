import { useState, useEffect, useCallback, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import { siteConfig } from '@/config/site';
import { nav } from '@/config/nav';
import { Button } from '@/components/ui/button';
import { Menu, X, Moon, Sun, Search, ChevronDown, Rss, Dice5 } from 'lucide-react';

interface NavbarProps {
  postIds?: string[];
}

export default function Navbar({ postIds = [] }: NavbarProps) {
  const [location, setLocation] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<number, boolean>>({});
  const [hoveredMenu, setHoveredMenu] = useState<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navItems = nav;

  useEffect(() => {
    setLocation(window.location.pathname);
    setIsDark(document.documentElement.classList.contains('dark'));

    const onSwap = () => {
      setLocation(window.location.pathname);
      setIsOpen(false);
      setOpenMenus({});
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    document.addEventListener('astro:after-swap', onSwap);
    return () => document.removeEventListener('astro:after-swap', onSwap);
  }, []);

  const handleMenuEnter = useCallback((idx: number) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoveredMenu(idx);
  }, []);

  const handleMenuLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setHoveredMenu(null);
    }, 150);
  }, []);

  const toggleTheme = () => {
    const willDark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', willDark);
    setIsDark(willDark);
    localStorage.setItem('theme', willDark ? 'dark' : 'light');
  };

  const goRandomPost = () => {
    if (!postIds.length) return;
    const random = postIds[Math.floor(Math.random() * postIds.length)];
    navigate(`/posts/${random}/`);
    setIsOpen(false);
  };

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent('open-search'));
    setIsOpen(false);
  };

  const themeLabel = isDark ? '切换到浅色模式' : '切换到深色模式';
  const menuLabel = isOpen ? '关闭菜单' : '打开菜单';

  return (
    <>
      <div className="h-16 w-full" />
      <nav
        className="border-border/40 bg-background/95 fixed top-0 left-0 z-50 w-full border-b backdrop-blur"
        aria-label="主导航"
      >
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight">
              {siteConfig.name}
            </a>

            <div className="hidden items-center gap-4 md:flex">
              {navItems.map((item, idx) => {
                const isActive =
                  item.href === location || item.children?.some((c) => c.href === location);

                if (item.children) {
                  const isMenuOpen = hoveredMenu === idx;
                  return (
                    <div
                      key={item.label}
                      className="relative"
                      onMouseEnter={() => handleMenuEnter(idx)}
                      onMouseLeave={handleMenuLeave}
                    >
                      <div
                        className={`hover:text-primary flex cursor-pointer items-center gap-1 text-sm font-medium transition-colors ${
                          isActive ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {item.label}
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${
                            isMenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      <div
                        className={`absolute top-full left-1/2 z-50 -translate-x-1/2 pt-1.5 transition-all duration-200 ease-out ${
                          isMenuOpen
                            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                            : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                        }`}
                      >
                        <div className="bg-card border-border w-20 rounded-md border py-2 shadow-md">
                          {item.children.map((c) => (
                            <a
                              key={c.href}
                              href={c.href}
                              target={c.href.startsWith('http') ? '_blank' : undefined}
                              rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className="text-muted-foreground hover:text-primary block px-4 py-1.5 text-center text-sm whitespace-nowrap"
                            >
                              {c.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <a
                    key={item.href}
                    href={item.href!}
                    className={`hover:text-primary text-sm font-medium transition-colors ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openSearch}
                  title="搜索"
                  aria-label="搜索"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goRandomPost}
                  disabled={!postIds.length}
                  title="随机文章"
                  aria-label="随机文章"
                >
                  <Dice5 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" asChild title="RSS 订阅" aria-label="RSS 订阅">
                  <a href="/feed/" title="RSS 订阅" aria-label="RSS 订阅">
                    <Rss className="h-5 w-5" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  title={themeLabel}
                  aria-label={themeLabel}
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={openSearch}
                title="搜索"
                aria-label="搜索"
              >
                <Search className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                title={menuLabel}
                aria-label={menuLabel}
              >
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <div
            className={`relative z-[1040] overflow-hidden ease-out md:hidden ${
              isOpen
                ? 'max-h-[600px] opacity-100 duration-500'
                : 'pointer-events-none max-h-0 opacity-0 duration-300'
            }`}
            role="navigation"
            aria-label="移动端导航菜单"
          >
            <div className="border-border/40 border-t py-3">
              <div className="flex flex-col">
                {navItems.map((item, idx) => {
                  const isActive =
                    item.href === location || item.children?.some((c) => c.href === location);

                  if (item.children) {
                    return (
                      <div key={item.label} className="mb-1">
                        <button
                          onClick={() => setOpenMenus((s) => ({ ...s, [idx]: !s[idx] }))}
                          className={`hover:text-primary flex w-full items-center justify-between py-2 text-left text-sm font-medium transition-colors ${
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {item.label}
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              openMenus[idx] ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        <div
                          className={`overflow-hidden ease-out ${
                            openMenus[idx]
                              ? 'max-h-[200px] translate-y-0 opacity-100 duration-500'
                              : 'pointer-events-none max-h-0 -translate-y-1 opacity-0 duration-300'
                          }`}
                        >
                          <div className="flex flex-col pl-3">
                            {item.children.map((c) => (
                              <a
                                key={c.href}
                                href={c.href}
                                target={c.href.startsWith('http') ? '_blank' : undefined}
                                rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                onClick={() => setIsOpen(false)}
                                className="text-muted-foreground hover:text-primary block py-2 text-sm"
                              >
                                {c.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={item.href}
                      href={item.href!}
                      onClick={() => setIsOpen(false)}
                      className={`hover:text-primary block py-2 text-sm font-medium transition-colors ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {item.label}
                    </a>
                  );
                })}

                <div className="border-border/40 my-3 border-t" />

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goRandomPost}
                    disabled={!postIds.length}
                    title="随机文章"
                    aria-label="随机文章"
                  >
                    <Dice5 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    title="RSS 订阅"
                    aria-label="RSS 订阅"
                  >
                    <a href="/feed/" title="RSS 订阅" aria-label="RSS 订阅">
                      <Rss className="h-5 w-5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    title={themeLabel}
                    aria-label={themeLabel}
                  >
                    {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
