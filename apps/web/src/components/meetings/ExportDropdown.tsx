'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase'
import { Download, Loader2, FileText, ChevronDown } from 'lucide-react'

interface ExportDropdownProps {
  meetingId: string
  onExportTriggered: () => void
}

export default function ExportDropdown({ meetingId, onExportTriggered }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState<string | null>(null)
  
  const formats = [
    { id: 'pdf', label: 'PDF Document (.pdf)', icon: '📄' },
    { id: 'docx', label: 'Word Document (.docx)', icon: '📝' },
    { id: 'txt', label: 'Plain Text (.txt)', icon: '🗒️' },
    { id: 'json', label: 'Raw Data (.json)', icon: '🔢' },
  ]

  const handleExport = async (format: string) => {
    setIsExporting(format)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/meetings/${meetingId}/exports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ format })
      })

      if (!response.ok) throw new Error('Export failed')
      
      onExportTriggered()
      setIsOpen(false)
    } catch (error) {
      alert('Failed to trigger export')
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl bg-[#1F2A44] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition-all outline-none"
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black ring-opacity-5 z-20 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-2 border-b border-gray-50">
               <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Download As</span>
            </div>
            {formats.map((f) => (
              <button
                key={f.id}
                disabled={!!isExporting}
                onClick={() => handleExport(f.id)}
                className="w-full flex items-center justify-between px-3 py-3 text-sm font-bold text-[#1F2A44] hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{f.icon}</span>
                  {f.label}
                </div>
                {isExporting === f.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
