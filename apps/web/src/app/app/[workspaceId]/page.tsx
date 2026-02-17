import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import UploadModal from '@/components/meetings/UploadModal'
import RecordModal from '@/components/meetings/RecordModal'
import MeetingList from '@/components/meetings/MeetingList'

interface Membership {
  role: 'admin' | 'member' | 'viewer'
}

export default function DashboardPage({ params }: { params: { workspaceId: string } }) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMembership() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const { data } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', params.workspaceId)
        .eq('user_id', session?.user?.id)
        .single()
      
      setMembership(data)
      setLoading(false)
    }
    fetchMembership()
  }, [params.workspaceId])

  const canEdit = membership?.role && membership.role !== 'viewer'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2A44]">Good morning, Workspace!</h1>
          <p className="text-gray-500">Here is what happened while you were away.</p>
        </div>
        
        {canEdit && (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsRecordModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#DC2626] active:scale-95 shadow-sm"
            >
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Record Now
            </button>
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="rounded-lg bg-[#1F2A44] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-95 border border-[#1F2A44]"
            >
              Upload Recording
            </button>
          </div>
        )}
      </div>

      {isUploadModalOpen && (
        <UploadModal 
          workspaceId={params.workspaceId} 
          onClose={() => setIsUploadModalOpen(false)} 
        />
      )}

      {isRecordModalOpen && (
        <RecordModal 
          workspaceId={params.workspaceId} 
          onClose={() => setIsRecordModalOpen(false)} 
        />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Meetings This Week', value: '12' },
          { label: 'Action Items Due', value: '5' },
          { label: 'Time Saved', value: '4.2h' },
          { label: 'Active Integrations', value: '3' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-[#1F2A44]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main Content Areas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1F2A44]">Recent Meetings</h2>
          <MeetingList workspaceId={params.workspaceId} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1F2A44]">Upcoming Meetings</h2>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 italic">No upcoming meetings scheduled.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
