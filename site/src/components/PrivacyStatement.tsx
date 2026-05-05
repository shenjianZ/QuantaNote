import { motion } from 'framer-motion'
import { ShieldCheck, Database, UserX, Eye } from 'lucide-react'

const points = [
  { icon: Database, text: 'Local SQLite database' },
  { icon: UserX, text: 'No accounts required' },
  { icon: Eye, text: 'No telemetry' },
  { icon: ShieldCheck, text: 'MIT licensed & open source' },
]

export default function PrivacyStatement() {
  return (
    <section className="px-5 py-24" style={{ background: 'var(--accent-soft)' }}>
      <div className="mx-auto max-w-3xl text-center">
        {/* Shield icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <ShieldCheck size={32} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-4 text-[28px] font-bold tracking-tight"
          style={{ color: 'var(--accent)' }}
        >
          Your data never leaves your machine.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-10 text-[15px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          QuantaNote stores everything in a local SQLite database. No cloud dependency, no vendor lock-in. Optional self-hosted sync if you choose.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {points.map(p => (
            <span
              key={p.text}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
              }}
            >
              <p.icon size={14} style={{ color: 'var(--accent)' }} />
              {p.text}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
