'use client'

import { Check, Loader2 } from 'lucide-react'

interface StatusStepperProps {
  status: 'draft' | 'uploaded' | 'processing' | 'ready' | 'failed'
  transcriptStatus?: 'processing' | 'ready' | 'failed'
}

export default function StatusStepper({ status, transcriptStatus }: StatusStepperProps) {
  const steps = [
    { id: 'uploaded', label: 'Uploaded' },
    { id: 'transcribing', label: 'Transcribing' },
    { id: 'summarizing', label: 'Summarizing' },
    { id: 'ready', label: 'Ready' },
  ]

  const getStepStatus = (stepId: string) => {
    if (status === 'failed') return 'failed'
    if (status === 'ready') return 'complete'

    if (stepId === 'uploaded') {
      return (status === 'uploaded' || status === 'processing') ? 'complete' : 'pending'
    }
    
    if (stepId === 'transcribing') {
      if (status === 'uploaded') return 'pending'
      if (status === 'processing') {
        return transcriptStatus === 'ready' ? 'complete' : 'current'
      }
      return 'pending'
    }

    if (stepId === 'summarizing') {
      if (status === 'processing' && transcriptStatus === 'ready') return 'current'
      return 'pending'
    }

    if (stepId === 'ready') {
      return 'pending'
    }

    return 'pending'
  }

  return (
    <div className="flex w-full items-center justify-between px-4 py-8">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.id)
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className={`flex ${!isLast ? 'flex-1' : ''} items-center`}>
            <div className="flex flex-col items-center">
              <div className={`
                flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500
                ${stepStatus === 'complete' ? 'bg-green-500 border-green-500 text-white' : ''}
                ${stepStatus === 'current' ? 'bg-blue-50 border-blue-500 text-blue-500' : ''}
                ${stepStatus === 'pending' ? 'bg-white border-gray-200 text-gray-400' : ''}
                ${stepStatus === 'failed' ? 'bg-red-50 border-red-500 text-red-500' : ''}
              `}>
                {stepStatus === 'complete' ? <Check className="h-5 w-5" /> : 
                 stepStatus === 'current' ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                 <span className="text-sm font-bold">{index + 1}</span>}
              </div>
              <span className={`mt-2 text-xs font-semibold uppercase tracking-wider
                ${stepStatus === 'current' ? 'text-blue-600' : stepStatus === 'complete' ? 'text-gray-900' : 'text-gray-400'}
              `}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`h-[2px] mb-6 flex-1 mx-4 transition-colors duration-500 ${stepStatus === 'complete' ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
