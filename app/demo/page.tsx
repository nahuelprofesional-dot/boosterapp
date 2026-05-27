import DemoChat from './DemoChat'

export const dynamic = 'force-static'

// Standalone demo. No Supabase, no auth, no network — pure in-memory state.
export default function DemoPage() {
  return <DemoChat />
}
