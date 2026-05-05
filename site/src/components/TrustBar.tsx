import { motion } from 'framer-motion'

const technologies = [
  { name: 'Tauri', icon: '⚡' },
  { name: 'React', icon: '⚛' },
  { name: 'Rust', icon: '🦀' },
  { name: 'SQLite', icon: '🗄' },
  { name: 'Tailwind CSS', icon: '🎨' },
  { name: 'TypeScript', icon: '📘' },
]

export default function TrustBar() {
  return (
    <section className="px-5 py-10" style={{ background: 'var(--chrome)' }}>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3"
      >
        {technologies.map((tech, i) => (
          <span key={tech.name} className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--muted)', opacity: 0.6 }}>
            <span className="text-base">{tech.icon}</span>
            {tech.name}
            {i < technologies.length - 1 && (
              <span className="ml-8 hidden h-1 w-1 rounded-full sm:inline-block" style={{ background: '#386c5f' }} />
            )}
          </span>
        ))}
      </motion.div>
    </section>
  )
}
