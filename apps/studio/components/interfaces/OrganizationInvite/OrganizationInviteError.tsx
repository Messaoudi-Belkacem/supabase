import { useRouter } from 'next/router'
import { Button, CardContent } from 'ui'
import { Admonition } from 'ui-patterns'

import AlertError from '@/components/ui/AlertError'
import { OrganizationInviteByToken } from '@/data/organization-members/organization-invitation-token-query'
import { useSignOut } from '@/lib/auth'
import { useProfile } from '@/lib/profile'
import type { ResponseError } from '@/types'

interface OrganizationInviteError {
  data?: OrganizationInviteByToken
  error?: ResponseError | null
  isError: boolean
  profileEmail?: string
  onSignOut?: () => Promise<void> | void
}

export const OrganizationInviteError = ({
  data,
  error,
  isError,
  profileEmail,
  onSignOut,
}: OrganizationInviteError) => {
  const router = useRouter()
  const signOut = useSignOut()
  const { profile } = useProfile()
  const displayedProfileEmail = profileEmail ?? profile?.primary_email

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut()
      return
    }

    await signOut()
    router.reload()
  }

  if (isError) {
    return (
      <CardContent>
        <AlertError error={error} subject="Failed to retrieve token" />
      </CardContent>
    )
  }

  if (!data?.email_match) {
    return (
      <CardContent>
        <Admonition
          type="warning"
          title="Wrong account"
          description={
            <>
              <p>
                This invite was sent to a different email address from the one you are using now.
              </p>
              {displayedProfileEmail && (
                <p>
                  You are currently signed in as{' '}
                  <span className="font-medium text-foreground">{displayedProfileEmail}</span>.
                </p>
              )}
              <p>Sign out, then sign in with the email address that received the invite.</p>
            </>
          }
          actions={
            <Button type="default" onClick={handleSignOut}>
              Sign out
            </Button>
          }
        />
      </CardContent>
    )
  }

  if (data.expired_token) {
    return (
      <CardContent>
        <Admonition
          type="warning"
          title="Invite expired"
          description="Ask the organisation owner to send you a new invite."
        />
      </CardContent>
    )
  }

  return (
    <CardContent>
      <Admonition
        type="warning"
        title="Invite invalid"
        description={
          <>
            <p>Try opening the full link from the invite email again.</p>
            <p>If that still does not work, ask the organisation owner to send a new invite.</p>
          </>
        }
      />
    </CardContent>
  )
}
