import { BookOpen, Download, Bug } from 'lucide-react'

function GithubIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

const links = [
  { icon: BookOpen, label: 'Documentation', href: 'https://quantanote-docs.shenjianl.cn' },
  { icon: GithubIcon, label: 'GitHub', href: 'https://github.com/shenjianZ/QuantaNote' },
  { icon: Download, label: 'Releases', href: 'https://github.com/shenjianZ/QuantaNote/releases' },
  { icon: Bug, label: 'Issues', href: 'https://github.com/shenjianZ/QuantaNote/issues' },
]

export default function Footer() {
  return (
    <footer className="px-5 py-14" style={{ background: 'var(--chrome)' }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 grid gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <img src="/icon.png" alt="QuantaNote" className="h-5 w-5 rounded" />
              <span className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
                QuantaNote
              </span>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              Local-first desktop note management. Your data, your rules.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              Resources
            </h4>
            <div className="flex flex-col gap-2">
              {links.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] no-underline transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  <link.icon size={13} />
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Built with */}
          <div>
            <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              Built with
            </h4>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              Rust + React + Tauri
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
              Made with care for privacy.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t pt-6 text-center" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
            &copy; 2026 QuantaNote. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
