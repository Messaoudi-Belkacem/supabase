import { motion } from 'framer-motion'
import { ArrowRightLeft } from 'lucide-react'
import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react'
import { Card, CardDescription, CardHeader, CardTitle, cn } from 'ui'

import { BASE_PATH } from '@/lib/constants'

const MotionCard = motion.create(Card)

interface InterstitialLayoutProps {
  logo?: ReactNode
  title?: string
  description?: string
}

/**
 * Minimal full-screen centered layout for interstitial flows:
 * partner authorization, org invites, CLI auth, credit redemption, etc.
 *
 * The logo, title, and description render inside the card (above children),
 * so every consumer gets a consistent header for free.
 */
export const InterstitialLayout = ({
  logo,
  title,
  description,
  children,
}: PropsWithChildren<InterstitialLayoutProps>) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState<number>()

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const updateHeight = () => {
      const nextHeight = content.getBoundingClientRect().height
      setCardHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateHeight)
    observer.observe(content)

    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-studio px-5">
      <MotionCard
        animate={cardHeight ? { height: cardHeight } : undefined}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="md:w-[400px]"
      >
        <div ref={contentRef}>
          {(logo || title || description) && (
            <CardHeader className="font-normal items-center gap-0 px-6 py-6 text-center [--card-padding-x:1.5rem] border-0">
              {logo && <div className="mb-4 flex justify-center">{logo}</div>}
              {title && (
                <CardTitle className="font-sans tracking-tight text-balance text-lg font-medium normal-case text-foreground">
                  {title}
                </CardTitle>
              )}
              {description && (
                <CardDescription className="!m-0 px-3 !text-balance text-sm text-foreground-lighter">
                  {description}
                </CardDescription>
              )}
            </CardHeader>
          )}
          {children}
        </div>
      </MotionCard>
    </div>
  )
}

/**
 * Standard rounded-rect logo container (48x48).
 * Partner logos fill edge-to-edge (see `PartnerLogo`); the Supabase symbol and
 * Lucide icons sit inset (sized at `size-7`).
 */
export const LogoBox = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn(
      'flex size-12 items-center justify-center overflow-hidden rounded-xl border bg-muted',
      className
    )}
  >
    {children}
  </div>
)

/** Two pre-boxed logos side-by-side with a swap separator. */
export const LogoPair = ({ left, right }: { left: ReactNode; right: ReactNode }) => (
  <div className="flex items-center justify-center gap-3">
    {left}
    <ArrowRightLeft className="size-4 text-foreground-muted" />
    {right}
  </div>
)

/** Partner logo rendered edge-to-edge inside a LogoBox. */
export const PartnerLogo = ({ src, alt }: { src: string; alt: string }) => (
  <LogoBox>
    <img alt={alt} src={src} className="size-full object-cover" />
  </LogoBox>
)

/** Supabase symbol (not the wordmark) rendered inset inside a LogoBox. */
export const SupabaseLogo = () => (
  <LogoBox>
    <img alt="Supabase" src={`${BASE_PATH}/img/supabase-logo.svg`} className="size-7" />
  </LogoBox>
)
