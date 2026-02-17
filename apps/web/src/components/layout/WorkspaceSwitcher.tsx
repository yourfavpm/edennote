import { createServerClient } from '@/utils/supabase-server'

export default async function WorkspaceSwitcher({ currentWorkspaceId }: { currentWorkspaceId: string }) {
  const supabase = createServerClient()
  
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name')

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100">
        <div className="h-6 w-6 rounded bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6] font-bold text-[10px]">
          {workspaces?.find(w => w.id === currentWorkspaceId)?.name?.charAt(0) || 'W'}
        </div>
        <span className="text-sm font-medium text-gray-700">
          {workspaces?.find(w => w.id === currentWorkspaceId)?.name || 'Select Workspace'}
        </span>
      </button>

      {/* Basic Dropdown Placeholder */}
      <div className="absolute left-0 mt-2 hidden min-w-[200px] flex-col rounded-lg border border-gray-200 bg-white py-2 shadow-lg group-hover:flex">
        {workspaces?.map((ws) => (
          <a
            key={ws.id}
            href={`/app/${ws.id}`}
            className={`px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
              ws.id === currentWorkspaceId ? 'font-bold text-[#3B82F6]' : 'text-gray-700'
            }`}
          >
            {ws.name}
          </a>
        ))}
        <div className="my-1 border-t border-gray-100" />
        <button className="px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50">
          + New Workspace
        </button>
      </div>
    </div>
  )
}
