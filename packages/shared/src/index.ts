import { z } from 'zod'

// AI Summary Schema
export const SummarySchema = z.object({
  executive_summary: z.string(),
  bullet_summary: z.array(z.string()),
  decisions: z.array(z.object({
    decision: z.string(),
    owner: z.string().optional(),
    timestamp_seconds: z.number().optional(),
    quote: z.string().optional(),
  })),
  action_items: z.array(z.object({
    task: z.string(),
    owner: z.string().optional(),
    due_date: z.string().optional(),
    confidence: z.number(),
    timestamp_seconds: z.number().optional(),
    quote: z.string().optional(),
  })),
  topics: z.array(z.object({
    title: z.string(),
    start_time_seconds: z.number(),
    summary: z.string(),
    key_quotes: z.array(z.object({
      quote: z.string(),
      speaker: z.string().optional(),
      timestamp_seconds: z.number().optional(),
    })).optional(),
  })),
  risks: z.array(z.string()),
  questions: z.array(z.string()),
})

export type Summary = z.infer<typeof SummarySchema>

// Meeting Status
export type MeetingStatus = 'draft' | 'uploaded' | 'processing' | 'ready' | 'failed'
export type MeetingSource = 'recording' | 'upload'

// BullMQ Job Types
export const ExportFormatSchema = z.enum(['pdf', 'docx', 'json', 'txt'])
export type ExportFormat = z.infer<typeof ExportFormatSchema>

export const ExportMeetingSchema = z.object({
  format: ExportFormatSchema
})

export type JobName = 'start_transcription' | 'fetch_transcript' | 'summarize_meeting' | 'export_meeting'

export interface MeetingJobData {
  meeting_id: string
  assemblyai_transcript_id?: string
  export_id?: string
  format?: ExportFormat
}

// Endpoints Schemas
export const CreateMeetingSchema = z.object({
  workspace_id: z.string().uuid(),
  title: z.string().min(1),
  source: z.enum(['recording', 'upload']),
  recording_mime: z.string().optional(),
})

export const UploadUrlSchema = z.object({
  file_ext: z.string().min(1),
  mime_type: z.string().min(1),
})

export const MarkUploadedSchema = z.object({
  object_path: z.string().min(1),
  recording_mime: z.string().optional(),
})

// Common API Response
export interface ApiResponse<T> {
  data?: T
  error?: string
}
