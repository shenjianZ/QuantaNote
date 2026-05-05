import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sun, Moon } from 'lucide-react'

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Screenshots', href: '#screenshots' },
  { label: 'Tech Stack', href: '#tech-stack' },
  { label: 'Download', href: '#download' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('data-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        backgroundColor: scrolled
          ? theme === 'dark'
            ? 'rgba(24,25,27,0.85)'
            : 'rgba(255,255,255,0.85)'
          : 'transparent',
        borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 text-[var(--text)] no-underline">
          <img src="/icon.png" alt="QuantaNote" className="h-6 w-6 rounded" />
          <span className="text-[15px] font-semibold tracking-tight">QuantaNote</span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium no-underline transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text)'
                e.currentTarget.style.background = 'var(--hover)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--muted)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://github.com/shenjianZ/QuantaNote"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.background = 'var(--hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <GithubIcon size={16} />
          </a>
          <button
            onClick={toggleTheme}
            className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 transition-colors"
            style={{ color: 'var(--muted)', background: 'transparent' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.background = 'var(--hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 md:hidden"
          style={{ color: 'var(--muted)', background: 'transparent' }}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden"
            style={{ background: 'var(--chrome)', borderBottom: '1px solid var(--line)' }}
          >
            <div className="flex flex-col gap-1 px-5 py-3">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-2 text-[14px] font-medium no-underline transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: 'var(--line)' }}>
                <a
                  href="https://github.com/shenjianZ/QuantaNote"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] no-underline"
                  style={{ color: 'var(--muted)' }}
                >
                  <GithubIcon size={15} /> GitHub
                </a>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 rounded-xl border-0 px-3 py-2 text-[14px] cursor-pointer"
                  style={{ color: 'var(--muted)', background: 'transparent' }}
                >
                  {theme === 'light' ? <><Moon size={15} /> Dark</> : <><Sun size={15} /> Light</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
