import { motion } from 'framer-motion'
import { ArrowRightLeft } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'
import { Card, CardContent, CardHeader, cn } from 'ui'

import { ProfileImage } from '@/components/ui/ProfileImage'
import { BASE_PATH } from '@/lib/constants'

const MotionCard = motion.create(Card)

interface InterstitialLayoutProps {
  logo?: ReactNode
  title?: ReactNode
  description?: ReactNode
  subtitle?: ReactNode
  headerOrder?: 'title-first' | 'description-first'
  titleClassName?: string
  descriptionClassName?: string
  subtitleClassName?: string
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
  subtitle,
  headerOrder = 'title-first',
  titleClassName,
  descriptionClassName,
  subtitleClassName,
  children,
}: PropsWithChildren<InterstitialLayoutProps>) => {
  const titleElement = title ? (
    <div
      className={cn(
        'font-sans tracking-tight text-balance text-lg font-medium normal-case text-foreground',
        titleClassName
      )}
    >
      {title}
    </div>
  ) : null

  const descriptionElement = description ? (
    <div
      className={cn(
        '!m-0 px-3 !text-balance text-sm text-foreground-lighter',
        descriptionClassName
      )}
    >
      {description}
    </div>
  ) : null

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-studio px-5">
      <MotionCard
        layout="size"
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden md:w-[400px]"
      >
        {(logo || title || description || subtitle) && (
          <CardHeader className="font-normal items-center gap-0 px-6 py-6 text-center [--card-padding-x:1.5rem] border-0">
            {logo && <div className="mb-4 flex justify-center">{logo}</div>}
            {headerOrder === 'description-first' ? (
              <>
                {descriptionElement}
                {titleElement}
              </>
            ) : (
              <>
                {titleElement}
                {descriptionElement}
              </>
            )}
            {subtitle && (
              <div className={cn('mt-2.5 text-sm text-foreground-lighter', subtitleClassName)}>
                {subtitle}
              </div>
            )}
          </CardHeader>
        )}
        {children}
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

export const InterstitialAccountRow = ({
  avatarUrl,
  displayName,
  action,
}: {
  avatarUrl?: string
  displayName?: string
  action?: ReactNode
}) => (
  <Card className="shadow-none">
    <CardContent className="flex items-center gap-3 border-none px-4 py-3">
      <ProfileImage
        src={avatarUrl}
        alt={displayName}
        className="size-8 flex-shrink-0 rounded-full border border-muted"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground-light">Signed in as</p>
        <p className="truncate text-sm text-foreground">
          {displayName || <span className="invisible">Loading account</span>}
        </p>
      </div>
      {action}
    </CardContent>
  </Card>
)
