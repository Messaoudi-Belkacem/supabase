import { useQuery } from '@tanstack/react-query'
import { useParams } from 'common'
import { CheckCircle2, LogOut } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  LogoLoader,
} from 'ui'
import { Admonition } from 'ui-patterns'

import {
  InterstitialLayout,
  LogoPair,
  PartnerLogo,
  SupabaseLogo,
} from '@/components/layouts/InterstitialLayout'
import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
import { ProfileImage } from '@/components/ui/ProfileImage'
import { useConfirmAccountRequestMutation } from '@/data/partners/stripe-projects-confirm-mutation'
import { accountRequestQueryOptions } from '@/data/partners/stripe-projects-query'
import { withAuth } from '@/hooks/misc/withAuth'
import { useSignOut } from '@/lib/auth'
import { BASE_PATH } from '@/lib/constants'
import { useProfileNameAndPicture } from '@/lib/profile'
import type { NextPageWithLayout } from '@/types'

// ---------------------------------------------------------------------------
// Mock data — design review only
// Navigate to /partners/stripe/projects/login?mock=<state> to preview each UI state.
// States: pending | linked | wrong-account | success
// ---------------------------------------------------------------------------
const MOCK_RESPONSES = {
  pending: {
    id: 'mock',
    email: 'jane@acmecorp.io',
    email_matches: true,
    status: 'pending' as const,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    linked_organization: undefined,
  },
  linked: {
    id: 'mock',
    email: 'jane@acmecorp.io',
    email_matches: true,
    status: 'pending' as const,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    linked_organization: { id: 42, name: 'Acme Corp', slug: 'acme-corp' },
  },
  'wrong-account': {
    id: 'mock',
    email: 'jane@acmecorp.io',
    email_matches: false,
    status: 'pending' as const,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    linked_organization: undefined,
  },
  success: {
    id: 'mock',
    email: 'jane@acmecorp.io',
    email_matches: true,
    status: 'complete' as const,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    linked_organization: undefined,
  },
}

type MockState = keyof typeof MOCK_RESPONSES

const StripeProjectsLoginPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ar_id } = useParams()

  const signOut = useSignOut()
  const { username, primaryEmail, avatarUrl } = useProfileNameAndPicture()

  const mockParam = router.query.mock as MockState | undefined
  const isMockMode =
    process.env.NODE_ENV !== 'production' && !!mockParam && mockParam in MOCK_RESPONSES

  const [mockConfirming, setMockConfirming] = useState(false)
  const [mockConfirmed, setMockConfirmed] = useState(false)

  useEffect(() => {
    setMockConfirming(false)
    setMockConfirmed(false)
  }, [mockParam])

  const {
    data: accountRequest,
    isPending,
    isSuccess,
    isError,
    error,
  } = useQuery({
    ...accountRequestQueryOptions({ arId: ar_id }),
    enabled: !isMockMode && typeof ar_id !== 'undefined',
  })

  const {
    mutate: confirmAccountRequest,
    isPending: isConfirming,
    isSuccess: isConfirmed,
  } = useConfirmAccountRequestMutation()

  useEffect(() => {
    if (!router.isReady) return
    if (isMockMode) return

    if (!ar_id) {
      router.push('/404')
      return
    }
  }, [router.isReady, ar_id, isMockMode, router])

  const handleApprove = async () => {
    if (isMockMode) {
      setMockConfirming(true)
      setTimeout(() => {
        setMockConfirming(false)
        setMockConfirmed(true)
      }, 1200)
      return
    }
    if (!ar_id || isConfirming) return
    confirmAccountRequest({ arId: ar_id })
  }

  // Overlay real state with mock values when in mock mode
  const effectiveAccountRequest = isMockMode
    ? MOCK_RESPONSES[mockParam as MockState]
    : accountRequest
  const effectiveIsPending = isMockMode ? false : isPending
  const effectiveIsSuccess = isMockMode ? mockParam !== 'success' : isSuccess
  const effectiveIsConfirmed = isMockMode ? mockParam === 'success' || mockConfirmed : isConfirmed
  const effectiveIsConfirming = isMockMode ? mockConfirming : isConfirming
  const effectiveIsError = isMockMode ? false : isError

  const linkedOrg = effectiveAccountRequest?.linked_organization
  const emailMatches = effectiveAccountRequest?.email_matches ?? false

  const displayName = primaryEmail ?? username ?? ''
  const showSuccessBranch = effectiveIsSuccess && !effectiveIsConfirmed

  return (
    <>
      {isMockMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="warning" size="tiny" className="fixed right-3 top-3 z-50 font-mono">
              mock: {mockParam}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuRadioGroup
              value={mockParam}
              onValueChange={(value) => {
                router.replace(
                  { pathname: router.pathname, query: { ...router.query, mock: value } },
                  undefined,
                  { shallow: true }
                )
                setMockConfirming(false)
                setMockConfirmed(false)
              }}
            >
              {Object.keys(MOCK_RESPONSES).map((state) => (
                <DropdownMenuRadioItem key={state} value={state} className="font-mono text-xs">
                  {state}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="px-6 pb-6">
        {/* Loading */}
        {effectiveIsPending && (
          <div className="flex flex-col items-center gap-3 py-4">
            <LogoLoader />
          </div>
        )}

        {/* Success */}
        {effectiveIsConfirmed && (
          <div className="py-4 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-brand-200">
                <CheckCircle2 className="size-7 text-brand" />
              </div>
            </div>
            <p className="text-lg font-semibold text-foreground">Stripe connected</p>
            <p className="mt-1 text-sm text-foreground-light">You can close this tab.</p>
          </div>
        )}

        {/* Wrong account */}
        {showSuccessBranch && !emailMatches && (
          <div className="flex flex-col gap-3">
            <Admonition
              type="warning"
              title="Wrong account"
              description={
                <>
                  Sign in as{' '}
                  <span className="font-medium text-foreground">
                    {effectiveAccountRequest?.email}
                  </span>{' '}
                  to continue.
                </>
              }
            />
            <Button type="default" block onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        )}

        {/* Linked — org already connected */}
        {showSuccessBranch && emailMatches && linkedOrg && (
          <div className="flex flex-col gap-3">
            <Admonition
              type="tip"
              title="Confirm connection"
              description={
                <>
                  <span className="font-medium text-foreground">{linkedOrg.name}</span> is already
                  linked to this Stripe account, and just needs to be confirmed.
                </>
              }
            />
            <div className="flex flex-col gap-2">
              <Button type="primary" block loading={effectiveIsConfirming} onClick={handleApprove}>
                Confirm
              </Button>
              <Button type="text" block onClick={() => router.push('/')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Pending — new org will be created */}
        {showSuccessBranch && emailMatches && !linkedOrg && (
          <div className="flex flex-col gap-6">
            {/* Current user */}
            <div className="flex items-center gap-3 rounded-lg border border-secondary p-3">
              <ProfileImage
                src={avatarUrl}
                alt={displayName}
                className="size-9 flex-shrink-0 rounded-full border"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground-light">Signed in as</p>
                <p className="truncate text-sm text-foreground">{displayName}</p>
              </div>
              <ButtonTooltip
                type="text"
                size="small"
                className="h-8 w-8 px-0"
                onClick={() => signOut()}
                icon={<LogOut size={16} strokeWidth={1.5} className="text-foreground-lighter" />}
                tooltip={{
                  content: {
                    side: 'top',
                    text: 'Sign out',
                  },
                }}
              />
            </div>

            {/* TODO Extract into helper? */}
            <div className="flex flex-col gap-2">
              <Button
                type="primary"
                loading={effectiveIsConfirming}
                disabled={effectiveIsConfirming}
                onClick={handleApprove}
              >
                Create organization
              </Button>
              <Button type="text" onClick={() => router.push('/')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {effectiveIsError && (
          <div className="flex flex-col gap-3">
            <Admonition
              type="danger"
              title="Unable to load authorization"
              description={error?.message}
            />
            <Button type="default" block onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

StripeProjectsLoginPage.getLayout = (page) => (
  <InterstitialLayout
    logo={
      <LogoPair
        left={<PartnerLogo src={`${BASE_PATH}/img/icons/stripe-icon.svg`} alt="Stripe" />}
        right={<SupabaseLogo />}
      />
    }
    title="Stripe Projects"
    description="wants to connect to Supabase"
  >
    {page}
  </InterstitialLayout>
)

export default withAuth(StripeProjectsLoginPage)
