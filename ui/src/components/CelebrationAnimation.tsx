import { useEffect, useState } from 'react'

/**
 * Kawaii pixel-art celebration animation.
 * Renders a burst of pixel sparkles and a tiny dancing star character
 * that plays for ~1.5s then auto-dismisses.
 */
export function CelebrationAnimation({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 1800)
    return () => clearTimeout(timer)
  }, [onComplete])

  if (!visible) return null

  return (
    <div className="celebration-overlay" aria-hidden="true">
      {/* Pixel sparkles */}
      <div className="sparkle sparkle-1" />
      <div className="sparkle sparkle-2" />
      <div className="sparkle sparkle-3" />
      <div className="sparkle sparkle-4" />
      <div className="sparkle sparkle-5" />
      <div className="sparkle sparkle-6" />

      {/* Kawaii star character */}
      <div className="kawaii-star">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ imageRendering: 'pixelated' }}>
          {/* Star body - pixel art style */}
          <rect x="10" y="0" width="4" height="2" fill="#FFD700" />
          <rect x="8" y="2" width="8" height="2" fill="#FFD700" />
          <rect x="0" y="4" width="24" height="2" fill="#FFD700" />
          <rect x="2" y="6" width="20" height="2" fill="#FFD700" />
          <rect x="4" y="8" width="16" height="2" fill="#FFD700" />
          <rect x="2" y="10" width="20" height="2" fill="#FFD700" />
          <rect x="0" y="12" width="24" height="2" fill="#FFD700" />
          <rect x="8" y="14" width="8" height="2" fill="#FFD700" />
          <rect x="10" y="16" width="4" height="2" fill="#FFD700" />
          {/* Kawaii face */}
          <rect x="8" y="6" width="2" height="2" fill="#1a1a2e" />
          <rect x="14" y="6" width="2" height="2" fill="#1a1a2e" />
          <rect x="10" y="10" width="4" height="2" fill="#ff6b9d" />
          {/* Blush */}
          <rect x="6" y="8" width="2" height="2" fill="#ff6b9d" opacity="0.5" />
          <rect x="16" y="8" width="2" height="2" fill="#ff6b9d" opacity="0.5" />
        </svg>
      </div>
    </div>
  )
}
