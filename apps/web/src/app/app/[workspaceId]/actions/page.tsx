'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase'
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, ExternalLink, User } from 'lucide-react'

interface ActionItem {
  id: string
  meeting_id: string
  description: string
  owner_user_id: string | null
  due_date: string | null
  status: 'open' | 'done'
  confidence: number
  source_timestamp_seconds: number | null
  meetings: { title: string }
}

type Tab = 'assigned' | 'all' | 'overdue' | 'completed'

export default function ActionsPage({ params }: { params: { workspaceId: string } }) {
  const [actions, setActions] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      setCurrentUserId(session?.user?.id || null)

      const { data } = await supabase
        .from('actions')
        .select('*, meetings(title)')
        .eq('workspace_id', params.workspaceId)
        .order('created_at', { ascending: false })
      
      if (data) setActions(data)
      setLoading(false)
    }

    fetchData()
  }, [params.workspaceId, supabase])

  const toggleStatus = async (id: string, currentStatus: 'open' | 'done') => {
    const newStatus = currentStatus === 'open' ? 'done' : 'open'
    
    // Optimistic update
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))

    const { error } = await supabase
      .from('actions')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      // Revert on error
      setActions(prev => prev.map(a => a.id === id ? { ...a, status: currentStatus } : a))
      alert('Failed to update status')
    }
  }

  const filteredActions = actions.filter(action => {
    if (activeTab === 'assigned') return action.owner_user_id === currentUserId
    if (activeTab === 'completed') return action.status === 'done'
    if (activeTab === 'overdue') {
      if (action.status === 'done' || !action.due_date) return false
      return new Date(action.due_date) < new Date()
    }
    return true // 'all'
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2A44]">Action Items</h1>
          <p className="text-sm text-gray-500">Track and manage tasks from your meetings.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'all', label: 'All Tasks' },
          { id: 'assigned', label: 'Assigned to me' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'completed', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-6 py-3 text-sm font-bold transition-colors relative ${
              activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-gray-100 mb-4" />
            <h3 className="text-lg font-semibold text-[#1F2A44]">No tasks found</h3>
            <p className="text-gray-500 mt-2">Try switching tabs or check back after your next meeting.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4">Task</th>
                <th className="px-6 py-4">Meeting</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 italic">
              {filteredActions.map((action) => (
                <tr key={action.id} className={`group hover:bg-gray-50 transition-colors ${action.status === 'done' ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleStatus(action.id, action.status)}
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                        action.status === 'done' 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-gray-300 hover:border-blue-500'
                      }`}
                    >
                      {action.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold text-[#1F2A44] ${action.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                        {action.description}
                      </span>
                      {action.source_timestamp_seconds !== null && (
                        <Link 
                          href={`/app/${params.workspaceId}/meetings/${action.meeting_id}?t=${action.source_timestamp_seconds}`}
                          className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View in context
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/app/${params.workspaceId}/meetings/${action.meeting_id}`} className="font-medium text-gray-600 hover:text-[#1F2A44]">
                      {action.meetings.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {action.due_date ? (
                      <div className={`flex items-center gap-1.5 font-bold ${
                        new Date(action.due_date) < new Date() && action.status !== 'done' ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(action.due_date).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-gray-300">No due date</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                         <User className="h-3.5 w-3.5" />
                       </div>
                       <span className="text-xs font-bold text-gray-500">
                         {action.owner_user_id === currentUserId ? 'Me' : 'Unassigned'}
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
