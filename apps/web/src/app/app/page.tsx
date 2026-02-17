import { createServerClient } from '@/utils/supabase-server'
import { redirect } from 'next/navigation'

export default async function AppRootPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Check for workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .limit(1)
    .single()

  if (membership) {
    redirect(`/app/${membership.workspace_id}`)
  }

  // No workspace? Create default one
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: 'My Workspace',
      owner_user_id: session.user.id
    })
    .select()
    .single()

  if (wsError || !workspace) {
    console.error('Failed to create workspace:', wsError)
    return <div>Failed to initialize workspace. Please contact support.</div>
  }

  // Add user as owner in workspace_members
  await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: session.user.id,
      role: 'owner'
    })

  redirect(`/app/${workspace.id}`)
}
