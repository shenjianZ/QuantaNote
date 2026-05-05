import { motion } from 'framer-motion'

const layers = [
  {
    title: 'Frontend',
    techs: [
      { name: 'React 19', desc: 'UI framework' },
      { name: 'TypeScript', desc: 'Type safety' },
      { name: 'Zustand 5', desc: 'State management' },
      { name: 'TailwindCSS 4', desc: 'Styling' },
      { name: 'Vditor 3', desc: 'Markdown editor' },
    ],
  },
  {
    title: 'Backend',
    techs: [
      { name: 'Tauri 2', desc: 'Desktop shell' },
      { name: 'Rust', desc: 'Systems language' },
      { name: 'rusqlite', desc: 'SQLite bindings' },
      { name: 'reqwest', desc: 'HTTP client' },
    ],
  },
  {
    title: 'Database',
    techs: [
      { name: 'SQLite', desc: 'Embedded database' },
      { name: 'WAL mode', desc: 'Write-ahead logging' },
      { name: 'FTS5', desc: 'Full-text search' },
      { name: 'Trigram', desc: 'CJK substring search' },
    ],
  },
  {
    title: 'Testing',
    techs: [
      { name: 'Vitest', desc: 'Unit tests' },
      { name: 'Playwright', desc: 'E2E tests' },
      { name: 'cargo test', desc: 'Rust tests' },
    ],
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
} as const

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

export default function TechStack() {
  return (
    <section id="tech-stack" className="px-5 py-24" style={{ background: 'var(--app-bg)' }}>
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="mb-3 text-[28px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Built with modern, proven technology
          </h2>
          <p className="text-[15px]" style={{ color: 'var(--muted)' }}>
            Every layer is chosen for performance, reliability, and developer experience.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {layers.map(layer => (
            <motion.div
              key={layer.title}
              variants={cardVariants}
              className="rounded-3xl p-6"
              style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}
            >
              <h3
                className="mb-4 text-[13px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--accent)' }}
              >
                {layer.title}
              </h3>
              <div className="flex flex-col gap-2.5">
                {layer.techs.map(tech => (
                  <div key={tech.name} className="flex items-baseline justify-between gap-2">
                    <span
                      className="font-mono text-[13px] font-medium"
                      style={{ color: 'var(--text)' }}
                    >
                      {tech.name}
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                      {tech.desc}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
