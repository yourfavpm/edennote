'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { Download, Loader2, FileText, CheckCircle2, Clock } from 'lucide-react'

interface ExportListProps {
  meetingId: string
  refreshTrigger: number
}

interface ExportRow {
  id: string
  format: string
  object_path: string
  download_url?: string
  created_at: string
}

export default function ExportList({ meetingId, refreshTrigger }: ExportListProps) {
  const [exports, setExports] = useState<ExportRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchExports() {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/meetings/${meetingId}/exports`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      const json = await response.json()
      const data = json.data as ExportRow[]
      if (data) setExports(data)
      setLoading(false)
    }

    fetchExports()

    // Realtime subscription for export updates
    const channel = supabase
      .channel(`exports:${meetingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exports', filter: `meeting_id=eq.${meetingId}` },
        () => fetchExports()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [meetingId, refreshTrigger, supabase])

  if (loading) return null
  if (exports.length === 0) return null

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
      <h3 className="text-xl font-black text-[#1F2A44] mb-6">Recent Exports</h3>
      <div className="space-y-3">
        {exports.map((exp) => (
          <div key={exp.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 group hover:border-blue-100 transition-all">
            <div className="flex items-center gap-4">
               <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
                 <FileText className="h-5 w-5" />
               </div>
               <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1F2A44] uppercase">{exp.format} Export</span>
                    {!exp.download_url && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded">
                        <Clock className="h-2 w-2 animate-spin" />
                        Generating...
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-400">
                    {new Date(exp.created_at).toLocaleString()}
                  </span>
               </div>
            </div>
            {exp.download_url && (
              <a 
                href={exp.download_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-xs font-bold text-[#1F2A44] shadow-sm hover:bg-gray-100 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
