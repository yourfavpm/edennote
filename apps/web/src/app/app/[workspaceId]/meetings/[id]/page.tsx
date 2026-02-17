'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase-client'
import StatusStepper from '@/components/meetings/StatusStepper'
import { 
  Loader2, FileText, ListChecks, MessageSquare, 
  AlertCircle, Search, Edit2, Check, X, 
  ChevronDown, ChevronUp, Play, Clock, Shield, User
} from 'lucide-react'
import ExportDropdown from '@/components/meetings/ExportDropdown'
import ExportList from '@/components/meetings/ExportList'

interface Meeting {
  id: string
  title: string
  status: 'draft' | 'uploaded' | 'processing' | 'ready' | 'failed'
  created_at: string
  workspace_id: string
  failure_reason?: string
}

interface Transcript {
  id: string
  text_long: string
  segments_json?: any[]
  status?: 'processing' | 'ready' | 'failed'
}

interface Summary {
  id: string
  exec_summary: string
  bullet_summary: string[]
  topics: any[]
  action_items: any[]
  decisions: any[]
}

export default function MeetingDetailPage({ params }: { params: { workspaceId: string, id: string } }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditingTranscript, setIsEditingTranscript] = useState(false)
  const [editedTranscriptText, setEditedTranscriptText] = useState('')
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({})
  const [exportTrigger, setExportTrigger] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch role
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', params.workspaceId)
        .eq('user_id', session.user.id)
        .single()
      setRole(memberData?.role || null)

      const { data: meetingData } = await supabase
        .from('meetings')
        .select('*, transcripts(*), summaries(*)')
        .eq('id', params.id)
        .single()
      
      if (meetingData) {
        setMeeting(meetingData)
        const t = meetingData.transcripts?.[0]
        setTranscript(t)
        setSummary(meetingData.summaries?.[0])
        setEditedTranscriptText(t?.text_long || '')
      }
      setLoading(false)
    }

    fetchData()

    // Realtime subscription
    const channel = supabase
      .channel(`meeting_detail_enhanced:${params.id}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${params.id}` },
        (payload: { new: Meeting }) => {
          setMeeting((prev) => prev ? { ...prev, ...payload.new } : payload.new)
          if (payload.new.status === 'ready') fetchData()
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'transcripts', filter: `meeting_id=eq.${params.id}` },
        (payload: { eventType: string, new: Transcript }) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setTranscript(payload.new)
            if (!isEditingTranscript) setEditedTranscriptText(payload.new.text_long)
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'summaries', filter: `meeting_id=eq.${params.id}` },
        (payload: { new: Summary }) => setSummary(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [params.id, params.workspaceId, supabase, isEditingTranscript])

  const handleSaveTranscript = async () => {
    if (!transcript) return
    const { error } = await supabase
      .from('transcripts')
      .update({ text_long: editedTranscriptText })
      .eq('id', transcript.id)
    
    if (error) {
      alert('Failed to save transcript')
    } else {
      setIsEditingTranscript(false)
    }
  }

  const handleRetry = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/meetings/${params.id}/retry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })

    if (response.ok && meeting) {
      setMeeting({ ...meeting, status: 'uploaded', failure_reason: undefined })
    } else if (!response.ok) {
      alert('Failed to trigger retry')
    }
  }

  const toggleActionStatus = async (itemIndex: number) => {
    if (role === 'viewer' || !summary) return
    const updatedActionItems = [...summary.action_items]
    const item = updatedActionItems[itemIndex]
    item.status = item.status === 'done' ? 'open' : 'done'

    setSummary({ ...summary, action_items: updatedActionItems })

    await supabase
      .from('summaries')
      .update({ action_items: updatedActionItems })
      .eq('id', summary.id)
  }

  const filteredTranscript = useMemo(() => {
    if (!transcript?.text_long || !searchTerm) return transcript?.text_long || ''
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    return transcript.text_long.split(regex).map((part: string, i: number) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded">{part}</mark> 
        : (part as any)
    )
  }, [transcript?.text_long, searchTerm])

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  )

  if (!meeting) return (
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <AlertCircle className="h-16 w-16 text-red-500" />
      <h2 className="text-2xl font-bold text-[#1F2A44]">Meeting Missing</h2>
      <p className="text-gray-500 max-w-sm font-medium">This record either doesn't exist or has been archived.</p>
    </div>
  )

  const isReady = meeting.status === 'ready'
  const canEdit = role !== 'viewer'

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meeting.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {meeting.status}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(meeting.created_at).toLocaleString()}
            </span>
          </div>
          <h1 className="text-4xl font-black text-[#1F2A44] tracking-tight leading-tight">{meeting.title}</h1>
        </div>
        <div className="flex gap-2">
           <button className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-sm font-bold text-[#1F2A44] shadow-sm hover:bg-gray-50 transition-all">
             Share Record
           </button>
           <ExportDropdown meetingId={params.id} onExportTriggered={() => setExportTrigger(t => t + 1)} />
        </div>
      </div>

      {!isReady && meeting.status !== 'failed' && (
        <div className="rounded-3xl border border-gray-100 bg-white p-12 shadow-xl shadow-blue-900/5">
          <div className="flex flex-col items-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <div className="text-center">
               <h3 className="text-2xl font-black text-[#1F2A44]">AI Insights Engine is Running</h3>
               <p className="text-gray-500 mt-2 font-medium">We're turning your audio into structured knowledge.</p>
            </div>
            <div className="w-full max-w-2xl">
              <StatusStepper status={meeting!.status} transcriptStatus={transcript?.status} />
            </div>
          </div>
        </div>
      )}

      {meeting.status === 'failed' && (
        <div className="rounded-3xl border border-red-100 bg-red-50/30 p-12 shadow-xl shadow-red-900/5">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
               <h3 className="text-2xl font-black text-[#1F2A44]">Processing Failed</h3>
               <p className="text-red-700 mt-2 font-bold bg-red-100/50 px-4 py-2 rounded-xl border border-red-100 inline-block">
                 {meeting.failure_reason || 'An unexpected error occurred during background processing.'}
               </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={handleRetry}
                className="flex items-center gap-2 rounded-xl bg-[#1F2A44] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 hover:opacity-95 transition-all"
              >
                <Play className="h-4 w-4" />
                Retry Processing
              </button>
            </div>
          </div>
        </div>
      )}

      {isReady && summary && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Insights (8 columns) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Executive Summary */}
            <section className="rounded-3xl border border-gray-100 bg-white p-10 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black text-[#1F2A44]">Executive Summary</h2>
                </div>
              </div>
              <div className="prose prose-blue max-w-none">
                <p className="text-lg leading-relaxed text-[#1F2A44] font-medium whitespace-pre-wrap">
                  {summary.exec_summary}
                </p>
                <div className="mt-8 border-t border-gray-50 pt-8">
                   <h4 className="text-sm font-bold text-[#1F2A44] uppercase tracking-widest mb-4">Key Bullet Points</h4>
                   <ul className="space-y-3">
                     {summary.bullet_summary?.map((pt: string, i: number) => (
                       <li key={i} className="flex gap-3 text-gray-600 font-medium">
                         <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                         {pt}
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </section>

            {/* Topics Accordion */}
            <section className="rounded-3xl border border-gray-100 bg-white p-10 shadow-sm">
              <h2 className="text-2xl font-black text-[#1F2A44] mb-8">Discussion Topics</h2>
              <div className="space-y-4">
                {summary.topics?.map((topic: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden transition-all hover:border-gray-200">
                    <button 
                      onClick={() => setExpandedTopics(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-blue-500 bg-blue-50 px-2 py-1 rounded">
                          {topic.start_time_seconds ? `${Math.floor(topic.start_time_seconds / 60)}:${(topic.start_time_seconds % 60).toString().padStart(2, '0')}` : '0:00'}
                        </span>
                        <span className="text-lg font-bold text-[#1F2A44] text-left">{topic.title}</span>
                      </div>
                      {expandedTopics[i] ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </button>
                    {expandedTopics[i] && (
                      <div className="px-6 pb-6 pt-2 bg-gray-50/30 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-gray-600 font-medium leading-relaxed mb-4">{topic.summary}</p>
                        {topic.key_quotes?.length > 0 && (
                          <div className="space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#1F2A44]/50">Key Quotes</span>
                            {topic.key_quotes.map((q: any, qi: number) => (
                              <div key={qi} className="bg-white p-4 rounded-xl border border-gray-100 border-l-4 border-l-blue-500 shadow-sm italic text-sm text-[#1F2A44] font-medium">
                                "{q.quote}"
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Transcript Viewer */}
            <section className="rounded-3xl border border-gray-100 bg-white p-10 shadow-sm">
              <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black text-[#1F2A44]">Transcript</h2>
                </div>
                <div className="flex items-center gap-3">
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                     <input 
                       type="text" 
                       placeholder="Search transcript..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="pl-10 pr-4 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 font-medium"
                     />
                   </div>
                   {canEdit && (
                     <button 
                       onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                       className={`p-2 rounded-full transition-all ${isEditingTranscript ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-500'}`}
                     >
                       {isEditingTranscript ? <Check className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}
                     </button>
                   )}
                </div>
              </div>

              <div className="relative min-h-[300px]">
                {isEditingTranscript ? (
                  <div className="space-y-4">
                    <textarea 
                      value={editedTranscriptText}
                      onChange={(e) => setEditedTranscriptText(e.target.value)}
                      className="w-full h-[600px] p-6 rounded-2xl border-2 border-blue-100 focus:border-blue-500 focus:outline-none font-medium leading-relaxed resize-none custom-scrollbar"
                    />
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setIsEditingTranscript(false)}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveTranscript}
                        className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 max-h-[700px] overflow-y-auto px-2 custom-scrollbar pr-4">
                    {/* Simplified for now if we don't have perfect segment mapping in UI, just show text */}
                    {/* But if we had segments_json, we'd loop them here */}
                    {transcript?.segments_json ? (
                      transcript.segments_json.map((seg: any, i: number) => (
                        <div key={i} className="flex gap-6 group">
                          <div className="flex flex-col items-center pt-1 w-16 flex-shrink-0">
                            <span className="text-[10px] font-black text-gray-400 tabular-nums">
                              {seg.start ? `${Math.floor(seg.start / 1000 / 60)}:${(Math.floor(seg.start / 1000) % 60).toString().padStart(2, '0')}` : '0:00'}
                            </span>
                            <div className="mt-2 h-full w-[2px] bg-gray-50 group-last:hidden" />
                          </div>
                          <div className="flex-1 pb-4">
                             <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-xs font-black uppercase tracking-widest ${seg.speaker === 'A' ? 'text-blue-500' : 'text-purple-500'}`}>
                                  Speaker {seg.speaker}
                                </span>
                             </div>
                             <p className="text-[#1F2A44] font-medium leading-relaxed">
                               {seg.text}
                             </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-lg text-[#1F2A44] font-medium leading-relaxed whitespace-pre-wrap">
                        {filteredTranscript}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar Insights (4 columns) */}
          <div className="lg:col-span-4 space-y-8">
            {/* Action Items */}
            <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-6 w-6 text-green-500" />
                  <h2 className="text-xl font-black text-[#1F2A44]">Action Items</h2>
                </div>
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  {summary.action_items?.length || 0}
                </span>
              </div>
              <ul className="space-y-4">
                {summary.action_items?.map((item: any, i: number) => (
                  <li 
                    key={i} 
                    onClick={() => toggleActionStatus(i)}
                    className={`group relative flex flex-col rounded-2xl border p-4 transition-all cursor-pointer ${
                    item.status === 'done' 
                      ? 'bg-gray-50 border-gray-100 opacity-60' 
                      : 'bg-white border-gray-100 hover:border-green-100 hover:shadow-lg hover:shadow-green-900/5'
                  }`}>
                    <div className="flex items-start gap-3">
                       <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                         item.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-300'
                       }`}>
                         {item.status === 'done' && <Check className="h-2.5 w-2.5 text-white" />}
                       </div>
                       <span className={`text-sm font-bold leading-tight ${item.status === 'done' ? 'line-through text-gray-400' : 'text-[#1F2A44]'}`}>
                         {item.task}
                       </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                       <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                         <User className="h-3 w-3" />
                         {item.owner || 'Unassigned'}
                       </div>
                       <span className="text-[10px] font-black text-green-600">
                         {(item.confidence * 100).toFixed(0)}% AI CONFIDENCE
                       </span>
                    </div>
                  </li>
                )) || <p className="text-center py-10 text-gray-400 italic">No tasks identified.</p>}
              </ul>
            </section>

            {/* Decisions */}
            <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-black text-[#1F2A44]">Key Decisions</h2>
              <ul className="space-y-4">
                {summary.decisions?.map((d: any, i: number) => (
                  <li key={i} className="flex gap-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                    <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/40">
                      <Play className="h-3 w-3 fill-current ml-0.5" />
                    </div>
                    <p className="text-sm font-bold text-[#1F2A44] leading-relaxed">
                      {d.decision}
                    </p>
                  </li>
                )) || <p className="text-center py-10 text-gray-400 italic">No decisions recorded.</p>}
              </ul>
            </section>

            {/* Viewer Notice */}
            {role === 'viewer' && (
              <div className="rounded-2xl bg-amber-50 p-4 flex items-start gap-3 border border-amber-100">
                <Shield className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-bold text-amber-700 leading-normal">
                  You are in Viewer mode. Collaborative features like editing or task check-offs are disabled.
                </p>
              </div>
            )}

            <ExportList meetingId={params.id} refreshTrigger={exportTrigger} />
          </div>
        </div>
      )}
    </div>
  )
}
