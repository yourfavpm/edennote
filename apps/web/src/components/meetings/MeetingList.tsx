'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase'
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Meeting {
  id: string
  title: string
  status: 'draft' | 'uploaded' | 'processing' | 'ready' | 'failed'
  created_at: string
}

export default function MeetingList({ workspaceId }: { workspaceId: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchMeetings() {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, status, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (data) setMeetings(data)
      setLoading(false)
    }

    fetchMeetings()

    // Realtime subscription
    const channel = supabase
      .channel(`meetings:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setMeetings((prev) => [payload.new as Meeting, ...prev].slice(0, 10))
          } else if (payload.eventType === 'UPDATE') {
            setMeetings((prev) =>
              prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
            )
          } else if (payload.eventType === 'DELETE') {
            setMeetings((prev) => prev.filter((m) => m.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (meetings.length === 0) {
    return <p className="text-sm text-gray-500 italic py-4">No recent meetings found.</p>
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-3">Meeting</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {meetings.map((meeting) => (
            <tr key={meeting.id} className="group hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4">
                <Link href={`/app/${workspaceId}/meetings/${meeting.id}`} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-500 group-hover:bg-[#1F2A44]/10 group-hover:text-[#1F2A44]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-[#1F2A44]">{meeting.title}</span>
                </Link>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={meeting.status} />
              </td>
              <td className="px-4 py-4 text-gray-500 text-xs">
                {new Date(meeting.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const configs: Record<string, { color: string, icon: any, label: string, animate?: boolean }> = {
    draft: { color: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Draft' },
    uploaded: { color: 'bg-blue-100 text-blue-600', icon: CheckCircle2, label: 'Uploaded' },
    processing: { color: 'bg-amber-100 text-amber-600', icon: Loader2, label: 'Processing', animate: true },
    ready: { color: 'bg-green-100 text-green-600', icon: CheckCircle2, label: 'Ready' },
    failed: { color: 'bg-red-100 text-red-600', icon: AlertCircle, label: 'Failed' },
  }

  const config = configs[status] || configs.draft
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
      <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  )
}
