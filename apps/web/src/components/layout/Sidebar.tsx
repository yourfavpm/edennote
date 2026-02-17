import Link from 'next/link'
import { LayoutDashboard, FileVideo, CheckSquare, Search, Box, Settings, Sparkles } from 'lucide-react'
import WorkspaceSwitcher from './WorkspaceSwitcher'

const navItems = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Meetings', href: '/meetings', icon: FileVideo },
  { label: 'Action Items', href: '/actions', icon: CheckSquare },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Integrations', href: '/integrations', icon: Box },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar({ workspaceId }: { workspaceId: string }) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center px-6 gap-3">
        <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
      </div>

      <nav className="mt-4 space-y-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={`/app/${workspaceId}${item.href}`}
            className="group flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-[#3B82F6]"
          >
            <item.icon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-[#3B82F6]" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-6 w-full px-3">
        <button className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-[#3B82F6]/5 hover:text-[#3B82F6]">
          <Sparkles className="mr-3 h-5 w-5 text-[#3B82F6]" />
          Upgrade
        </button>
      </div>
    </aside>
  )
}
