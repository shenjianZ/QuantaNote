import { motion } from 'framer-motion'
import { Download, Shield, Monitor, WifiOff } from 'lucide-react'

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

// Use Vite's import.meta.glob to reference screenshots
const heroScreenshot = `${import.meta.env.BASE_URL}app-img/library.png`

const badges = [
  { icon: Shield, label: 'MIT License' },
  { icon: Monitor, label: 'Cross-Platform' },
  { icon: WifiOff, label: 'Offline-First' },
]

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-14" style={{ background: 'var(--app-bg)' }}>
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, var(--accent-soft) 0%, transparent 70%)',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-5 text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          Your notes. Your machine. Your rules.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="mx-auto mb-8 max-w-xl text-[16px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          A local-first desktop note app with Markdown editing, full-text search, tag management, attachments, and version history. All data stays on your device.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="mb-6 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href="#download"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold no-underline transition-all"
            style={{ background: '#386c5f', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = '#386c5f')}
          >
            <Download size={16} />
            Download v0.2.2
          </a>
          <a
            href="https://github.com/shenjianZ/QuantaNote"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold no-underline transition-all"
            style={{ border: '1px solid var(--line)', color: 'var(--text)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <GithubIcon size={16} />
            View on GitHub
          </a>
        </motion.div>

        {/* Badges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          className="mb-12 flex flex-wrap items-center justify-center gap-2"
        >
          {badges.map(badge => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
              style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}
            >
              <badge.icon size={12} />
              {badge.label}
            </span>
          ))}
        </motion.div>

        {/* Screenshot mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
          className="relative mx-auto max-w-4xl"
        >
          <div
            className="overflow-hidden rounded-xl"
            style={{
              boxShadow: '0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px var(--line)',
              background: 'var(--chrome)',
            }}
          >
            {/* Window chrome dots */}
            <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ background: 'var(--chrome)', borderBottom: '1px solid var(--line)' }}>
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
            </div>
            <img
              src={heroScreenshot}
              alt="QuantaNote library view"
              className="block w-full"
              loading="eager"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
