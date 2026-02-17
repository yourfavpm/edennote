import { Bell, Search, User, Sparkles } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="fixed top-0 z-30 h-16 w-[calc(100%-256px)] ml-64 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-8">
        {/* Global Search */}
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search meetings, decisions, action items..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm transition-all focus:border-[#3B82F6] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/10"
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            <Sparkles className="h-4 w-4" />
            AI Quick Ask
          </button>
          
          <button className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100">
            <Bell className="h-5 w-5" />
          </button>

          <div className="h-8 w-8 rounded-full bg-[#1F2A44] flex items-center justify-center text-white text-xs font-bold ring-2 ring-white cursor-pointer hover:ring-gray-100 transition-all">
            BA
          </div>
        </div>
      </div>
    </header>
  )
}
