import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const PER_PAGE = 6

const screenshots = [
  { src: 'app-img/library.png', alt: 'Library view', caption: 'Library — Browse and search all your notes' },
  { src: 'app-img/note-preview.png', alt: 'Note preview', caption: 'Preview — Clean Markdown rendering' },
  { src: 'app-img/note-edit.png', alt: 'Note editing', caption: 'Editor — Full-featured Vditor IR mode' },
  { src: 'app-img/workspace.png', alt: 'Workspace', caption: 'Workspace — Quick capture with Ctrl+Enter' },
  { src: 'app-img/search-cmd.png', alt: 'Command palette', caption: 'Command Palette — Ctrl+K global search' },
  { src: 'app-img/note-version.png', alt: 'Version history', caption: 'Version History — Diff and restore' },
  { src: 'app-img/settings-appearance.png', alt: 'Appearance settings', caption: 'Settings — Theme and appearance' },
  { src: 'app-img/settings-font.png', alt: 'Font settings', caption: 'Settings — Font family and size' },
  { src: 'app-img/settings-data.png', alt: 'Data settings', caption: 'Settings — Data export and import' },
  { src: 'app-img/settings-sync.png', alt: 'Sync settings', caption: 'Settings — Cloud sync options' },
  { src: 'app-img/settings-about.png', alt: 'About page', caption: 'Settings — About and version info' },
  { src: 'app-img/topbar-more.png', alt: 'Top bar menu', caption: 'Top Bar — Quick actions and more menu' },
  { src: 'app-img/account.png', alt: 'Account page', caption: 'Account — User account overview' },
  { src: 'app-img/accoun-login.png', alt: 'Login page', caption: 'Account — Sign in to your account' },
  { src: 'app-img/account-register.png', alt: 'Register page', caption: 'Account — Create a new account' },
  { src: 'app-img/account-profile.png', alt: 'Profile page', caption: 'Account — Edit your profile' },
]

const base = import.meta.env.BASE_URL
const totalPages = Math.ceil(screenshots.length / PER_PAGE)

export default function ScreenshotGallery() {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  const goPrev = useCallback(() => setPage(p => Math.max(0, p - 1)), [])
  const goNext = useCallback(() => setPage(p => Math.min(totalPages - 1, p + 1)), [])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') setLightbox(i => (i !== null ? (i - 1 + screenshots.length) % screenshots.length : null))
      if (e.key === 'ArrowRight') setLightbox(i => (i !== null ? (i + 1) % screenshots.length : null))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const pageScreenshots = screenshots.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

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

        {/* Screenshot grid — 3 columns */}
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {pageScreenshots.map((shot, i) => {
              const globalIdx = page * PER_PAGE + i
              return (
                <motion.div
                  key={shot.src}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="group cursor-pointer"
                  onClick={() => setLightbox(globalIdx)}
                >
                  <motion.div
                    className="overflow-hidden rounded-xl transition-shadow duration-300"
                    style={{
                      boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      border: '1px solid var(--line)',
                    }}
                    whileHover={{ scale: 1.02, boxShadow: '0 16px 50px rgba(0,0,0,0.12)' }}
                  >
                    <img src={`${base}${shot.src}`} alt={shot.alt} className="block w-full" loading="lazy" />
                  </motion.div>
                  <p className="mt-3 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
                    {shot.caption}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={goPrev}
              disabled={page === 0}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 transition-colors disabled:opacity-30 disabled:cursor-default"
              style={{ background: 'var(--hover)', color: 'var(--text)' }}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className="h-2.5 w-2.5 cursor-pointer rounded-full border-0 transition-all"
                  style={{
                    background: i === page ? 'var(--accent)' : 'var(--line)',
                    transform: i === page ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
            <button
              onClick={goNext}
              disabled={page === totalPages - 1}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 transition-colors disabled:opacity-30 disabled:cursor-default"
              style={{ background: 'var(--hover)', color: 'var(--text)' }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
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

            {/* Lightbox prev arrow */}
            <button
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              onClick={e => { e.stopPropagation(); setLightbox(i => (i !== null ? (i - 1 + screenshots.length) % screenshots.length : null)) }}
            >
              <ChevronLeft size={22} />
            </button>

            {/* Lightbox next arrow */}
            <button
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              onClick={e => { e.stopPropagation(); setLightbox(i => (i !== null ? (i + 1) % screenshots.length : null)) }}
            >
              <ChevronRight size={22} />
            </button>

            <motion.img
              key={lightbox}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              src={`${base}${screenshots[lightbox].src}`}
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
