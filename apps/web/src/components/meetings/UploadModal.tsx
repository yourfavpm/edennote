'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, FileAudio, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase'

interface UploadModalProps {
  workspaceId: string
  onClose: () => void
}

export default function UploadModal({ workspaceId, onClose }: UploadModalProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'uploading' | 'processing'>('idle')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""))
    }
  }

  const handleUpload = async () => {
    if (!file || !title) return

    setUploading(true)
    setError(null)
    setStep('uploading')
    setProgress(0)

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
          source: 'upload',
          recording_mime: file.type
        })
      })
      const { data: meeting, error: createError } = await createRes.json()
      if (createError) throw new Error(createError.message)

      // 2. Get signed upload URL
      const fileExt = file.name.split('.').pop()
      const urlRes = await fetch(`${apiBase}/v1/meetings/${meeting.id}/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          file_ext: fileExt,
          mime_type: file.type
        })
      })
      const { data: uploadData, error: urlError } = await urlRes.json()
      if (urlError) throw new Error(urlError.message)

      // 3. Upload to Supabase Storage
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadData.upload_url)
        xhr.setRequestHeader('Content-Type', file.type)
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setProgress(percent)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response)
          else reject(new Error('Upload failed'))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(file)
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
          recording_mime: file.type
        })
      })

      // 5. Trigger processing
      setStep('processing')
      await fetch(`${apiBase}/v1/meetings/${meeting.id}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Success!
      router.push(`/app/${workspaceId}/meetings/${meeting.id}`)
      onClose()
      
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Something went wrong during upload')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1F2A44]">Upload Recording</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {!uploading ? (
          <div className="mt-6 space-y-6">
            <div 
              className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 transition-colors hover:border-[#3B82F6]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const droppedFile = e.dataTransfer.files[0]
                if (droppedFile) {
                  setFile(droppedFile)
                  setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""))
                }
              }}
            >
              <input 
                type="file" 
                className="absolute inset-0 cursor-pointer opacity-0" 
                onChange={handleFileChange}
                accept="audio/*,video/*"
              />
              <Upload className="mb-4 h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                {file ? file.name : "Click or drag to upload"}
              </p>
              <p className="mt-1 text-xs text-gray-500">MP3, WAV, M4A, MP4, WEBM up to 100MB</p>
            </div>

            {file && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Meeting Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-[#3B82F6] focus:outline-none"
                  placeholder="Enter meeting title..."
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || !title}
              className="w-full rounded-lg bg-[#1F2A44] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Start Upload
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center pb-4">
            <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-[#3B82F6] transition-all duration-300" 
                style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
              ></div>
              <FileAudio className="h-10 w-10 text-[#3B82F6]" />
            </div>

            <h3 className="text-lg font-semibold text-[#1F2A44]">
              {step === 'uploading' ? `Uploading... ${progress}%` : 'Starting processing...'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {step === 'uploading' ? 'Please keep this window open.' : 'Sending to AI for transcription.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
