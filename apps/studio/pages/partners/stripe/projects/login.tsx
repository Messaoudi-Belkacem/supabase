import { useQuery } from '@tanstack/react-query'
import { useParams } from 'common'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from 'ui'
import { Admonition, ShimmeringLoader } from 'ui-patterns'

import {
  InterstitialAccountRow,
  InterstitialLayout,
  LogoPair,
  PartnerLogo,
  SupabaseLogo,
} from '@/components/layouts/InterstitialLayout'
import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
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

const getMockState = (value: unknown): MockState | undefined => {
  return typeof value === 'string' && value in MOCK_RESPONSES ? (value as MockState) : undefined
}

const isTemporaryMockPreviewEnabled = () => {
  if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'prod') return true
  if (typeof window === 'undefined') return false

  return window.location.hostname.endsWith('.vercel.app')
}

const StripeProjectsLoginPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { ar_id } = useParams()

  const signOut = useSignOut()
  const { username, primaryEmail, avatarUrl } = useProfileNameAndPicture()

  const [hasMounted, setHasMounted] = useState(false)
  const [mockConfirming, setMockConfirming] = useState(false)
  const [mockConfirmed, setMockConfirmed] = useState(false)

  const mockParamFromQuery = getMockState(router.query.mock)
  const hasMockParam = isTemporaryMockPreviewEnabled() && router.isReady && !!mockParamFromQuery
  const isMockMode = hasMounted && hasMockParam
  const mockParam = isMockMode ? mockParamFromQuery : undefined

  useEffect(() => {
    setHasMounted(true)
  }, [])

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
    enabled: !hasMockParam && typeof ar_id !== 'undefined',
  })

  const {
    mutate: confirmAccountRequest,
    isPending: isConfirming,
    isSuccess: isConfirmed,
  } = useConfirmAccountRequestMutation()

  useEffect(() => {
    if (!router.isReady) return
    if (hasMockParam) return

    if (!ar_id) {
      router.push('/404')
      return
    }
  }, [router.isReady, ar_id, hasMockParam, router])

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
  const effectiveIsPending = isMockMode ? false : router.isReady && isPending
  const effectiveIsSuccess = isMockMode ? mockParam !== 'success' : isSuccess
  const effectiveIsConfirmed = isMockMode ? mockParam === 'success' || mockConfirmed : isConfirmed
  const effectiveIsConfirming = isMockMode ? mockConfirming : isConfirming
  const effectiveIsError = isMockMode ? false : isError

  const linkedOrg = effectiveAccountRequest?.linked_organization
  const emailMatches = effectiveAccountRequest?.email_matches ?? false

  const displayName = primaryEmail ?? username ?? effectiveAccountRequest?.email ?? ''
  const showSuccessBranch = effectiveIsSuccess && !effectiveIsConfirmed
  const interstitialDescription = effectiveIsConfirmed
    ? 'Is connected to Supabase'
    : 'Wants to connect to Supabase'

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

      <InterstitialLayout
        logo={
          <LogoPair
            left={<PartnerLogo src={`${BASE_PATH}/img/icons/stripe-icon.svg`} alt="Stripe" />}
            right={<SupabaseLogo />}
          />
        }
        title="Stripe Projects"
        description={interstitialDescription}
      >
        <div className="px-6 pb-6">
          {/* Loading */}
          {effectiveIsPending && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 rounded-lg border border-secondary p-3">
                <ShimmeringLoader className="size-9 flex-shrink-0 rounded-full py-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <ShimmeringLoader className="h-3 w-20 py-0" />
                  <ShimmeringLoader className="h-4 w-40 max-w-full py-0" />
                </div>
                <div className="h-8 w-8 flex-shrink-0" />
              </div>
              <div className="flex flex-col gap-2">
                <ShimmeringLoader className="h-10 w-full py-0" />
                <ShimmeringLoader className="h-10 w-full py-0" />
              </div>
            </div>
          )}

          {/* Success */}
          {effectiveIsConfirmed && (
            <Admonition
              type="success"
              description="Stripe Projects is now connected to Supabase. You can close this tab."
            />
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
                description={
                  <>
                    <span className="font-medium text-foreground">{linkedOrg.name}</span> is already
                    linked to this Stripe account, and just needs to be confirmed.
                  </>
                }
              />
              <div className="flex flex-col gap-2">
                <Button
                  type="primary"
                  block
                  loading={effectiveIsConfirming}
                  onClick={handleApprove}
                >
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
              <InterstitialAccountRow
                avatarUrl={avatarUrl}
                displayName={displayName}
                action={
                  <ButtonTooltip
                    type="text"
                    size="small"
                    className="h-8 w-8 px-0"
                    onClick={() => signOut()}
                    icon={
                      <LogOut size={16} strokeWidth={1.5} className="text-foreground-lighter" />
                    }
                    tooltip={{
                      content: {
                        side: 'top',
                        text: 'Sign out',
                      },
                    }}
                  />
                }
              />

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
      </InterstitialLayout>
    </>
  )
}

export default withAuth(StripeProjectsLoginPage)
