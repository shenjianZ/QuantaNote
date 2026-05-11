import { motion } from 'framer-motion'
import { Download, Apple, Monitor, Laptop, ExternalLink } from 'lucide-react'

const platforms = [
  {
    icon: Monitor,
    name: 'Windows',
    formats: '.msi / .exe',
    href: 'https://github.com/shenjianZ/QuantaNote/releases/latest',
  },
  {
    icon: Apple,
    name: 'macOS',
    formats: '.dmg',
    href: 'https://github.com/shenjianZ/QuantaNote/releases/latest',
  },
  {
    icon: Laptop,
    name: 'Linux',
    formats: '.deb / .AppImage',
    href: 'https://github.com/shenjianZ/QuantaNote/releases/latest',
  },
]

export default function DownloadCTA() {
  return (
    <section id="download" className="relative overflow-hidden px-5 py-24" style={{ background: 'var(--app-bg)' }}>
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 50% 60% at 50% 50%, var(--accent-soft) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-3 text-[32px] font-bold tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          Get QuantaNote
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-10 text-[15px]"
          style={{ color: 'var(--muted)' }}
        >
          Available for Windows, macOS, and Linux. Free and open source.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 flex flex-wrap items-center justify-center gap-4"
        >
          {platforms.map(p => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl px-6 py-4 no-underline transition-all"
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid var(--line)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--hover)'
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--accent-soft)'
                e.currentTarget.style.borderColor = 'var(--line)'
              }}
            >
              <p.icon size={20} style={{ color: 'var(--accent)' }} />
              <div className="text-left">
                <div className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                  {p.name}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  {p.formats}
                </div>
              </div>
              <Download size={14} style={{ color: 'var(--accent)' }} />
            </a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center gap-3"
        >
          <a
            href="https://quantanote-docs.shenjianl.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] no-underline transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Or build from source
            <ExternalLink size={12} />
          </a>
          <span
            className="rounded-full px-3 py-1 text-[12px]"
            style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}
          >
            v0.2.1 — MIT License
          </span>
        </motion.div>
      </div>
    </section>
  )
}
