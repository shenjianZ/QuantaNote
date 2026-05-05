import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const screenshots = [
  { src: '/app-img/library.png', alt: 'Library view', caption: 'Library — Browse and search all your notes' },
  { src: '/app-img/note-preview.png', alt: 'Note preview', caption: 'Preview — Clean Markdown rendering' },
  { src: '/app-img/note-edit.png', alt: 'Note editing', caption: 'Editor — Full-featured Vditor IR mode' },
  { src: '/app-img/workspace.png', alt: 'Workspace', caption: 'Workspace — Quick capture with Ctrl+Enter' },
  { src: '/app-img/search-cmd.png', alt: 'Command palette', caption: 'Command Palette — Ctrl+K global search' },
  { src: '/app-img/note-version.png', alt: 'Version history', caption: 'Version History — Diff and restore' },
]

export default function ScreenshotGallery() {
  const [lightbox, setLightbox] = useState<number | null>(null)

  return (
    <section id="screenshots" className="px-5 py-24" style={{ background: 'var(--app-bg)' }}>
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="mb-3 text-[28px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Crafted with care
          </h2>
          <p className="text-[15px]" style={{ color: 'var(--muted)' }}>
            Every pixel is intentional. A clean interface that gets out of your way.
          </p>
        </motion.div>

        {/* Primary screenshots - 2 column */}
        <div className="mb-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {screenshots.slice(0, 3).map((shot, i) => (
            <motion.div
              key={shot.src}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group cursor-pointer"
              onClick={() => setLightbox(i)}
            >
              <motion.div
                className="overflow-hidden rounded-xl transition-shadow duration-300"
                style={{
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                  border: '1px solid var(--line)',
                }}
                whileHover={{ scale: 1.02, boxShadow: '0 16px 50px rgba(0,0,0,0.12)' }}
              >
                <img src={shot.src} alt={shot.alt} className="block w-full" loading="lazy" />
              </motion.div>
              <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
                {shot.caption}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Secondary screenshots - 3 column */}
        <div className="grid gap-5 md:grid-cols-3">
          {screenshots.slice(3).map((shot, i) => (
            <motion.div
              key={shot.src}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group cursor-pointer"
              onClick={() => setLightbox(i + 3)}
            >
              <motion.div
                className="overflow-hidden rounded-xl transition-shadow duration-300"
                style={{
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                  border: '1px solid var(--line)',
                }}
                whileHover={{ scale: 1.02, boxShadow: '0 16px 50px rgba(0,0,0,0.12)' }}
              >
                <img src={shot.src} alt={shot.alt} className="block w-full" loading="lazy" />
              </motion.div>
              <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
                {shot.caption}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-5 py-10"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              onClick={() => setLightbox(null)}
            >
              <X size={20} />
            </button>
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={screenshots[lightbox].src}
              alt={screenshots[lightbox].alt}
              className="max-h-full max-w-full rounded-xl object-contain"
              style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
