import { motion } from 'framer-motion'
import { FileText, Search, History, Tags, ArrowDownUp, Command, Paperclip, Database, Palette, Pin, Monitor } from 'lucide-react'

const features = [
  {
    icon: FileText,
    title: 'Markdown Editing',
    desc: 'Vditor IR mode with toolbar shortcuts, find & replace (Ctrl+F/H), table insertion, and code block syntax highlighting.',
  },
  {
    icon: Search,
    title: 'Full-Text Search',
    desc: 'Dual-engine FTS5 + trigram search in SQLite. Explicit support for Chinese substring search — no other app does this well.',
  },
  {
    icon: History,
    title: 'Version History',
    desc: 'Create, preview, and restore versions with side-by-side diff comparison. Manual save and auto-detection of content changes.',
  },
  {
    icon: Tags,
    title: 'Tag Management',
    desc: 'Many-to-many tag-item associations. Create, edit, and filter by tags. Color-coded pills with overflow indicators.',
  },
  {
    icon: ArrowDownUp,
    title: 'Import / Export',
    desc: 'Export as JSON (with attachments) or ZIP (selectable: tags, attachments, version history). Full data portability.',
  },
]

const secondaryFeatures = [
  { icon: Command, label: 'Command Palette' },
  { icon: Paperclip, label: 'Attachments' },
  { icon: Database, label: 'Auto Backup' },
  { icon: Palette, label: 'Dark / Light Theme' },
  { icon: Pin, label: 'Always on Top' },
  { icon: Monitor, label: 'Cross-Platform' },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
} as const

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

export default function Features() {
  return (
    <section id="features" className="px-5 py-24" style={{ background: 'var(--app-bg)' }}>
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="mb-3 text-[28px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Everything you need, nothing you don't
          </h2>
          <p className="text-[15px]" style={{ color: 'var(--muted)' }}>
            Powerful features wrapped in a clean, distraction-free interface.
          </p>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map(feature => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              className="group rounded-3xl p-6 transition-all duration-300"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
              }}
              whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: 'var(--accent-soft)' }}
              >
                <feature.icon size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 className="mb-2 text-[16px] font-semibold" style={{ color: 'var(--text)' }}>
                {feature.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Secondary features */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          {secondaryFeatures.map(f => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                border: '1px solid var(--line)',
                color: 'var(--muted)',
                background: 'var(--field)',
              }}
            >
              <f.icon size={12} />
              {f.label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
