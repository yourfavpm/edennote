'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Mic, Square, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase-client'

interface RecordModalProps {
  workspaceId: string
  onClose: () => void
}

export default function RecordModal({ workspaceId, onClose }: RecordModalProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'processing'>('idle')
  const [title, setTitle] = useState(`Recording ${new Date().toLocaleString()}`)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await handleUpload(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setStatus('recording')
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)

    } catch (err: any) {
      console.error(err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please enable permissions in your browser.')
      } else {
        setError('Could not start recording. Please check your microphone.')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const handleUpload = async (blob: Blob) => {
    setStatus('uploading')
    setProgress(0)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

      // 1. Create meeting draft
      const createRes = await fetch(`${apiBase}/v1/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title,
          source: 'recording',
          recording_mime: blob.type
        })
      })
      const { data: meeting, error: createError } = await createRes.json()
      if (createError) throw new Error(createError.message)

      // 2. Get signed upload URL
      const urlRes = await fetch(`${apiBase}/v1/meetings/${meeting.id}/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          file_ext: 'webm',
          mime_type: blob.type
        })
      })
      const { data: uploadData, error: urlError } = await urlRes.json()
      if (urlError) throw new Error(urlError.message)

      // 3. Upload Blob
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadData.upload_url)
        xhr.setRequestHeader('Content-Type', blob.type)
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response)
          else reject(new Error('Upload failed'))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(blob)
      })

      // 4. Mark uploaded
      await fetch(`${apiBase}/v1/meetings/${meeting.id}/mark-uploaded`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          object_path: uploadData.object_path,
          recording_mime: blob.type
        })
      })

      // 5. Trigger processing
      setStatus('processing')
      await fetch(`${apiBase}/v1/meetings/${meeting.id}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      router.push(`/app/${workspaceId}/meetings/${meeting.id}`)
      onClose()

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save recording')
      setStatus('idle')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1F2A44]">Direct Recording</h2>
          <button onClick={onClose} disabled={status === 'uploading' || status === 'processing'} className="rounded-full p-2 hover:bg-gray-100 disabled:opacity-30">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center space-y-6">
          {status === 'idle' && (
            <>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200">
                  <Mic className="h-10 w-10 text-gray-400" />
                </div>
                <div className="space-y-4 w-full">
                  <label className="block text-xs font-semibold text-left uppercase tracking-wider text-gray-500">Meeting Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-[#3B82F6] focus:outline-none"
                    placeholder="Enter meeting title..."
                  />
                </div>
              </div>
              <button
                onClick={startRecording}
                className="group flex items-center gap-2 rounded-full bg-[#1F2A44] px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-[#1F2A44]/90 active:scale-95"
              >
                <Mic className="h-4 w-4" />
                Start Recording
              </button>
            </>
          )}

          {status === 'recording' && (
            <>
              <div className="flex flex-col items-center">
                <div className="relative mb-6 h-28 w-28 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-[#EF4444]/10 animate-ping"></div>
                  <div className="relative h-20 w-20 rounded-full bg-[#EF4444] flex items-center justify-center shadow-lg shadow-[#EF4444]/40">
                    <Mic className="h-10 w-10 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-mono font-bold text-[#1F2A44]">{formatTime(duration)}</p>
                <p className="mt-1 text-sm text-gray-500 animate-pulse">Recording live...</p>
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-black active:scale-95"
              >
                <Square className="h-4 w-4 fill-white" />
                Stop and Save
              </button>
            </>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <div className="py-4 text-center">
              <div className="relative mb-6 h-24 w-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-[#3B82F6] transition-all duration-300" 
                  style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
                ></div>
                <Loader2 className="h-10 w-10 text-[#3B82F6] animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-[#1F2A44]">
                {status === 'uploading' ? `Saving... ${progress}%` : 'Starting processing...'}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {status === 'uploading' ? 'Sending audio to secure storage.' : 'Transcribing with AssemblyAI.'}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
