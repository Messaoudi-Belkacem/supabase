import { useIsLoggedIn, useParams } from 'common'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from 'ui'
import { Admonition, GenericSkeletonLoader } from 'ui-patterns'

import { OrganizationInviteError } from './OrganizationInviteError'
import { ProfileImage } from '@/components/ui/ProfileImage'
import { useOrganizationAcceptInvitationMutation } from '@/data/organization-members/organization-invitation-accept-mutation'
import {
  useOrganizationInvitationTokenQuery,
  type OrganizationInviteByToken,
} from '@/data/organization-members/organization-invitation-token-query'
import { useIsFeatureEnabled } from '@/hooks/misc/useIsFeatureEnabled'
import { useProfile, useProfileNameAndPicture } from '@/lib/profile'
import { ResponseError } from '@/types'

type MockState =
  | 'signed-out'
  | 'signed-out-no-sign-up'
  | 'loading'
  | 'ready'
  | 'joining'
  | 'wrong-account'
  | 'expired'
  | 'invalid'
  | 'no-longer-valid'
  | 'error'

type MockProfile = {
  username?: string
  primaryEmail?: string
  avatarUrl?: string
}

type MockConfig = {
  isLoggedIn: boolean
  isSignUpEnabled?: boolean
  isLoadingProfile?: boolean
  profile?: MockProfile
  invitationState?: 'loading' | 'success' | 'error'
  invitationData?: OrganizationInviteByToken
  invitationError?: ResponseError
  isJoining?: boolean
}

const MOCK_PROFILE: MockProfile = {
  username: 'jane',
  primaryEmail: 'jane@acmecorp.io',
}

const WRONG_ACCOUNT_PROFILE: MockProfile = {
  username: 'jane',
  primaryEmail: 'jane@personal.dev',
}

// ---------------------------------------------------------------------------
// Mock data — design review only
// Navigate to /join?mock=<state> to preview each invite UI branch locally.
// ---------------------------------------------------------------------------
const READY_INVITE: OrganizationInviteByToken = {
  authorized_user: true,
  email_match: true,
  expired_token: false,
  invite_id: 42,
  organization_name: 'Acme Corp',
  sso_mismatch: false,
  token_does_not_exist: false,
}

const INVITE_MOCKS: Record<MockState, MockConfig> = {
  'signed-out': {
    isLoggedIn: false,
    isSignUpEnabled: true,
  },
  'signed-out-no-sign-up': {
    isLoggedIn: false,
    isSignUpEnabled: false,
  },
  loading: {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'loading',
  },
  ready: {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'success',
    invitationData: READY_INVITE,
  },
  joining: {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'success',
    invitationData: READY_INVITE,
    isJoining: true,
  },
  'wrong-account': {
    isLoggedIn: true,
    profile: WRONG_ACCOUNT_PROFILE,
    invitationState: 'success',
    invitationData: {
      ...READY_INVITE,
      email_match: false,
    },
  },
  expired: {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'success',
    invitationData: {
      ...READY_INVITE,
      expired_token: true,
    },
  },
  invalid: {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'success',
    invitationData: {
      ...READY_INVITE,
      token_does_not_exist: true,
    },
  },
  'no-longer-valid': {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'error',
    invitationError: new ResponseError('Failed to retrieve organization', 401),
  },
  error: {
    isLoggedIn: true,
    profile: MOCK_PROFILE,
    invitationState: 'error',
    invitationError: new ResponseError('Failed to retrieve token', 500),
  },
}

export const OrganizationInvite = () => {
  const router = useRouter()
  const isLoggedIn = useIsLoggedIn()
  const { profile, isLoading: isLoadingProfile } = useProfile()
  const { username, avatarUrl, primaryEmail } = useProfileNameAndPicture()
  const { slug, token } = useParams()
  const mockParam = router.query.mock as MockState | undefined
  const isMockMode =
    process.env.NODE_ENV !== 'production' && !!mockParam && mockParam in INVITE_MOCKS
  const mockConfig = isMockMode ? INVITE_MOCKS[mockParam] : undefined

  const isSignUpEnabled = useIsFeatureEnabled('dashboard_auth:sign_up')
  const [mockJoining, setMockJoining] = useState(false)

  useEffect(() => {
    setMockJoining(false)
  }, [mockParam])

  const {
    data,
    error,
    isSuccess: isSuccessInvitation,
    isError: isErrorInvitation,
    isPending: isLoadingInvitation,
  } = useOrganizationInvitationTokenQuery(
    { slug, token },
    {
      retry: false,
      refetchOnWindowFocus: false,
      enabled: !!profile && !isMockMode,
    }
  )
  const effectiveIsLoggedIn = isMockMode ? (mockConfig?.isLoggedIn ?? false) : isLoggedIn
  const effectiveProfile = isMockMode ? mockConfig?.profile : profile
  const effectiveIsLoadingProfile = isMockMode
    ? (mockConfig?.isLoadingProfile ?? false)
    : isLoadingProfile
  const effectiveUsername = isMockMode ? mockConfig?.profile?.username : username
  const effectiveAvatarUrl = isMockMode ? mockConfig?.profile?.avatarUrl : avatarUrl
  const effectivePrimaryEmail = isMockMode ? mockConfig?.profile?.primaryEmail : primaryEmail
  const effectiveIsSignUpEnabled = isMockMode
    ? (mockConfig?.isSignUpEnabled ?? true)
    : isSignUpEnabled

  const effectiveData =
    isMockMode && mockConfig?.invitationState === 'success' ? mockConfig.invitationData : data
  const effectiveError =
    isMockMode && mockConfig?.invitationState === 'error' ? mockConfig.invitationError : error
  const effectiveIsSuccessInvitation = isMockMode
    ? mockConfig?.invitationState === 'success'
    : isSuccessInvitation
  const effectiveIsErrorInvitation = isMockMode
    ? mockConfig?.invitationState === 'error'
    : isErrorInvitation
  const effectiveIsLoadingInvitation = isMockMode
    ? mockConfig?.invitationState === 'loading'
    : isLoadingInvitation
  const effectiveHasError =
    effectiveIsErrorInvitation ||
    (effectiveIsSuccessInvitation &&
      !!effectiveData &&
      (effectiveData.token_does_not_exist ||
        effectiveData.expired_token ||
        !effectiveData.email_match))
  const inviteIsNoLongerValid =
    effectiveError?.code === 401 &&
    effectiveError.message.includes('Failed to retrieve organization')

  const organizationName = effectiveIsSuccessInvitation
    ? effectiveData?.organization_name
    : 'an organization'
  const invitationPath = isMockMode
    ? `/join?mock=${mockParam}`
    : `/join?token=${token}&slug=${slug}`
  const loginRedirectLink = `/sign-in?returnTo=${encodeURIComponent(invitationPath)}`
  const signupRedirectLink = `/sign-up?returnTo=${encodeURIComponent(invitationPath)}`

  const { mutate: joinOrganization, isPending: isJoining } =
    useOrganizationAcceptInvitationMutation({
      onSuccess: () => {
        router.push('/organizations')
      },
      onError: (error) => {
        toast.error(`Failed to join organization: ${error.message}`)
      },
    })

  const replaceMockState = (value: MockState) => {
    router.replace(
      { pathname: router.pathname, query: { ...router.query, mock: value } },
      undefined,
      { shallow: true }
    )
  }

  async function handleJoinOrganization() {
    if (isMockMode) {
      setMockJoining(true)
      return
    }
    if (!slug) return console.error('Slug is required')
    if (!token) return console.error('Token is required')
    joinOrganization({ slug, token })
  }

  const effectiveIsJoining = isMockMode ? mockConfig?.isJoining || mockJoining : isJoining
  const displayName = effectivePrimaryEmail ?? effectiveUsername ?? ''
  const mockSwitcher = isMockMode ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="warning" size="tiny" className="fixed right-3 top-3 z-50 font-mono">
          mock: {mockParam}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuRadioGroup
          value={mockParam}
          onValueChange={(value) => replaceMockState(value as MockState)}
        >
          {Object.keys(INVITE_MOCKS).map((state) => (
            <DropdownMenuRadioItem key={state} value={state} className="font-mono text-xs">
              {state}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const withMockSwitcher = (children: ReactNode) => (
    <>
      {mockSwitcher}
      {children}
    </>
  )

  if (!effectiveIsLoggedIn || (!effectiveProfile && !effectiveIsLoadingProfile)) {
    return withMockSwitcher(
      <>
        <CardContent className="text-center">
          <p className="text-center text-sm text-foreground-light text-balance">
            Sign in{effectiveIsSignUpEnabled ? ' or create an account' : ''} to view this invitation
          </p>
        </CardContent>
        <CardFooter className="justify-center gap-3">
          <Button asChild type="default">
            <Link href={loginRedirectLink}>Sign in</Link>
          </Button>
          {effectiveIsSignUpEnabled && (
            <Button asChild type="default">
              <Link href={signupRedirectLink}>Create an account</Link>
            </Button>
          )}
        </CardFooter>
      </>
    )
  }

  if (effectiveIsLoadingProfile || effectiveIsLoadingInvitation) {
    return withMockSwitcher(
      <CardContent>
        <GenericSkeletonLoader />
      </CardContent>
    )
  }

  if (inviteIsNoLongerValid) {
    return withMockSwitcher(
      <CardContent>
        <Admonition
          type="warning"
          title="Invite no longer available"
          description="This invite has already been accepted or declined."
          layout="responsive"
          actions={
            <Button type="default" asChild>
              <Link href="/">Back to dashboard</Link>
            </Button>
          }
        />
      </CardContent>
    )
  }

  if (effectiveHasError) {
    return withMockSwitcher(
      <OrganizationInviteError
        data={effectiveData}
        error={effectiveError}
        isError={effectiveIsErrorInvitation}
        profileEmail={effectivePrimaryEmail}
        onSignOut={
          isMockMode
            ? async () => {
                replaceMockState('signed-out')
              }
            : undefined
        }
      />
    )
  }

  return withMockSwitcher(
    <>
      <CardContent className="space-y-4">
        <p className="text-center text-sm text-foreground-light text-balance">
          You have been invited to join{' '}
          <strong className="text-foreground">{organizationName}</strong>
        </p>

        <Card className="shadow-none">
          <CardContent className="flex items-center justify-between gap-3 border-none px-4 py-3">
            <div className="flex items-center gap-3">
              <ProfileImage
                src={effectiveAvatarUrl}
                alt={displayName}
                className="h-8 w-8 flex-shrink-0 rounded-full border border-muted"
              />
              <div className="flex flex-col">
                <span className="text-sm text-foreground-light">Signed in as</span>
                <span className="text-sm font-medium text-foreground">{displayName}</span>
              </div>
            </div>
            <Button
              type="primary"
              loading={effectiveIsJoining}
              disabled={effectiveIsJoining}
              onClick={handleJoinOrganization}
            >
              Accept
            </Button>
          </CardContent>
        </Card>
      </CardContent>

      <CardFooter className="justify-center">
        <Button asChild type="text" block>
          <Link href="/projects">Decline</Link>
        </Button>
      </CardFooter>
    </>
  )
}
