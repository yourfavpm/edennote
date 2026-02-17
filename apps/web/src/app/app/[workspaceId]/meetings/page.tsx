'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase'
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, ChevronRight, Mic, Upload } from 'lucide-react'

interface Meeting {
  id: string
  title: string
  source: 'recording' | 'upload'
  status: 'draft' | 'uploaded' | 'processing' | 'ready' | 'failed'
  created_at: string
}

export default function MeetingsPage({ params }: { params: { workspaceId: string } }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchMeetings() {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, source, status, created_at')
        .eq('workspace_id', params.workspaceId)
        .order('created_at', { ascending: false })
      
      if (data) setMeetings(data)
      setLoading(false)
    }

    fetchMeetings()

    const channel = supabase
      .channel(`meetings_full:${params.workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `workspace_id=eq.${params.workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMeetings((prev) => [payload.new as Meeting, ...prev])
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
  }, [params.workspaceId, supabase])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2A44]">All Meetings</h1>
          <p className="text-sm text-gray-500">Manage and view your meeting records.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-12 w-12 text-gray-200 mb-4" />
            <h3 className="text-lg font-semibold text-[#1F2A44]">No meetings yet</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-2">Start by recording a meeting or uploading an audio file.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {meetings.map((meeting) => (
                <tr 
                  key={meeting.id} 
                  className="group hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/app/${params.workspaceId}/meetings/${meeting.id}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-hover:bg-[#1F2A44]/10 group-hover:text-[#1F2A44] transition-colors">
                        <FileText className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-[#1F2A44] text-base">{meeting.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600 font-medium">
                      {meeting.source === 'recording' ? (
                        <>
                          <Mic className="h-4 w-4 text-red-500" />
                          <span>Direct Record</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-blue-500" />
                          <span>File Upload</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={meeting.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-medium">
                    {new Date(meeting.created_at).toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-gray-300 group-hover:text-blue-500 transition-colors">
                      <ChevronRight className="h-5 w-5" />
                    </button>
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

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const configs: Record<string, { color: string, icon: any, label: string, animate?: boolean }> = {
    draft: { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Clock, label: 'Draft' },
    uploaded: { color: 'bg-blue-50 text-blue-600 border-blue-100', icon: CheckCircle2, label: 'Uploaded' },
    processing: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Loader2, label: 'Processing', animate: true },
    ready: { color: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle2, label: 'Ready' },
    failed: { color: 'bg-red-50 text-red-600 border-red-100', icon: AlertCircle, label: 'Failed' },
  }

  const config = configs[status] || configs.draft
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${config.color}`}>
      <Icon className={`h-3 w-3 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  )
}
