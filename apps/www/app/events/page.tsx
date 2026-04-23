import { EventClientRenderer } from '~/components/Events/new/EventClientRenderer'
import { getMdxEvents, getNotionEvents } from '~/lib/events'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'View all Supabase events and meetups.',
  description:
    'Find all the upcoming events, webinars and meetups hosted by supabase and its community.',
}

export default async function EventsPage() {
  const [notionEvents, mdxEvents] = await Promise.all([
    getNotionEvents(),
    Promise.resolve(getMdxEvents()),
  ])

  return <EventClientRenderer notionEvents={notionEvents} mdxEvents={mdxEvents} />
}
