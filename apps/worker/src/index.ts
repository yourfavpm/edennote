import { Worker, Job, Queue } from 'bullmq'
import { MeetingJobData, JobName } from '@eden-note/shared'
import { supabaseAdmin } from './lib/supabase'
import * as assembly from './lib/assembly'
import * as llm from './lib/llm'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  throw new Error('Worker: REDIS_URL is not defined')
}

// Re-initialize queue for enqueuing from worker
const meetingQueue = new Queue<MeetingJobData, any, JobName>('meeting-processing', {
  connection: { url: redisUrl } as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  }
})

const BASE_WEBHOOK_URL = process.env.BASE_WEBHOOK_URL
const ASSEMBLYAI_WEBHOOK_SECRET = process.env.ASSEMBLYAI_WEBHOOK_SECRET

const worker = new Worker<MeetingJobData, any, JobName>(
  'meeting-processing',
  async (job: Job<MeetingJobData, any, JobName>) => {
    const { meeting_id, assemblyai_transcript_id } = job.data

    console.log(`[Worker] Processing job ${job.name} for meeting ${meeting_id}`)

    try {
      if (job.name === 'start_transcription') {
        const { data: meeting, error: mError } = await supabaseAdmin
          .from('meetings')
          .select('*')
          .eq('id', meeting_id)
          .single()
        
        if (mError || !meeting) throw new Error(`Meeting not found: ${meeting_id}`)

        if (meeting.title.includes('FAIL')) {
          throw new Error('TEST FAILURE: meeting title contains FAIL')
        }

        const { data: urlData, error: uError } = await supabaseAdmin.storage
          .from('recordings')
          .createSignedUrl(meeting.recording_object_path, 3600)
        
        if (uError || !urlData) throw new Error(`Signed URL fail: ${uError?.message}`)

        const webhookUrl = `${BASE_WEBHOOK_URL}/v1/webhooks/assemblyai`
        const transcript = await assembly.createTranscript({
          audio_url: urlData.signedUrl,
          webhook_url: webhookUrl,
          webhook_auth_header_name: 'x-webhook-secret',
          webhook_auth_header_value: ASSEMBLYAI_WEBHOOK_SECRET || ''
        })

        await supabaseAdmin
          .from('transcripts')
          .upsert({
            meeting_id: meeting_id,
            assemblyai_transcript_id: transcript.id,
            status: 'processing'
          }, { onConflict: 'meeting_id' })

        console.log(`[Worker] AssemblyAI transcript ${transcript.id} created for ${meeting_id}`)
      }

      if (job.name === 'fetch_transcript') {
        if (!assemblyai_transcript_id) throw new Error('Missing transcript_id for fetch')

        const transcriptData = await assembly.getTranscript(assemblyai_transcript_id)
        const utterancesData = await assembly.getUtterances(assemblyai_transcript_id)

        const { error: tError } = await supabaseAdmin
          .from('transcripts')
          .update({
            text_long: transcriptData.text,
            segments_json: utterancesData.utterances,
            words_json: transcriptData.words,
            confidence_avg: transcriptData.confidence,
            status: 'ready'
          })
          .eq('meeting_id', meeting_id)

        if (tError) throw tError

        console.log(`[Worker] Transcript fetched and saved for ${meeting_id}. Enqueuing summary...`)
        await meetingQueue.add('summarize_meeting', { meeting_id })
      }

      if (job.name === 'summarize_meeting') {
        // 1. Get transcript and meeting info
        const { data: meeting, error: mError } = await supabaseAdmin
          .from('meetings')
          .select('*, transcripts(*)')
          .eq('id', meeting_id)
          .single()

        if (mError || !meeting) throw new Error(`Meeting info not found: ${meeting_id}`)
        if (!meeting.transcripts || !meeting.transcripts[0]?.text_long) {
          throw new Error('No transcript text found for summarization')
        }

        const transcriptText = meeting.transcripts[0].text_long
        
        // 2. AI Summarization
        console.log(`[Worker] Starting LLM summarization for ${meeting_id}`)
        const summary = await llm.summarizeMeeting(meeting.title, transcriptText)

        // 3. Persist Summary
        const { data: summaryRow, error: sError } = await supabaseAdmin
          .from('summaries')
          .upsert({
            meeting_id,
            exec_summary: summary.executive_summary,
            bullet_summary: summary.bullet_summary,
            decisions: summary.decisions,
            action_items: summary.action_items,
            topics: summary.topics,
            risks: summary.risks,
            questions: summary.questions,
            prompt_version: 'v1'
          }, { onConflict: 'meeting_id' })
          .select()
          .single()

        if (sError) throw sError

        // 4. Normalize Action Items
        await supabaseAdmin.from('actions').delete().eq('meeting_id', meeting_id)
        
        if (summary.action_items.length > 0) {
          const actionsToInsert = summary.action_items.map((ai: any) => ({
            meeting_id,
            workspace_id: meeting.workspace_id,
            description: ai.task,
            owner_user_id: null, // We don't have UUIDs for owners yet from LLM
            due_date: ai.due_date ? new Date(ai.due_date).toISOString().split('T')[0] : null,
            confidence: ai.confidence,
            source_timestamp_seconds: ai.timestamp_seconds,
            source_quote: ai.quote
          }))
          
          const { error: aError } = await supabaseAdmin.from('actions').insert(actionsToInsert)
          if (aError) throw aError
        }

        // 5. Finalize Meeting
        await supabaseAdmin
          .from('meetings')
          .update({ status: 'ready' })
          .eq('id', meeting_id)

        console.log(`[Worker] Summarization complete for ${meeting_id}. Meeting set to READY.`)
      }

      if (job.name === 'export_meeting') {
        const { export_id, format } = job.data
        if (!export_id || !format) throw new Error('Missing export_id or format')

        // 1. Get meeting data
        const { data: meeting, error: mError } = await supabaseAdmin
          .from('meetings')
          .select('*, transcripts(*), summaries(*)')
          .eq('id', meeting_id)
          .single()

        if (mError || !meeting) throw new Error('Meeting not found for export')

        const summary = meeting.summaries?.[0]
        const transcript = meeting.transcripts?.[0]
        const dateStr = new Date(meeting.created_at).toLocaleDateString()

        let content: Buffer | string
        let contentType: string
        const fileName = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.${format}`

        if (format === 'json') {
          content = JSON.stringify({ meeting, summary, transcript }, null, 2)
          contentType = 'application/json'
        } else if (format === 'txt') {
          content = `Title: ${meeting.title}\nDate: ${dateStr}\n\nEXECUTIVE SUMMARY\n${summary?.exec_summary || 'N/A'}\n\nTRANSCRIPT\n${transcript?.text_long || 'N/A'}`
          contentType = 'text/plain'
        } else if (format === 'pdf') {
          const { jsPDF } = await import('jspdf')
          const doc = new jsPDF()
          doc.setFontSize(20)
          doc.text(meeting.title, 10, 20)
          doc.setFontSize(12)
          doc.text(`Date: ${dateStr}`, 10, 30)
          doc.text('Executive Summary:', 10, 50)
          doc.setFontSize(10)
          const splitSummary = doc.splitTextToSize(summary?.exec_summary || 'N/A', 180)
          doc.text(splitSummary, 10, 60)
          content = Buffer.from(doc.output('arraybuffer'))
          contentType = 'application/pdf'
        } else if (format === 'docx') {
          const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
          const doc = new Document({
            sections: [{
              properties: {},
              children: [
                new Paragraph({ text: meeting.title, heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ children: [new TextRun({ text: `Date: ${dateStr}`, bold: true })] }),
                new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
                new Paragraph({ text: summary?.exec_summary || 'N/A' }),
              ],
            }],
          })
          content = await Packer.toBuffer(doc)
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        } else {
          throw new Error(`Unsupported format: ${format}`)
        }

        const objectPath = `${meeting.workspace_id}/${meeting.id}/exports/${export_id}.${format}`

        // 2. Upload to Storage
        const { error: sError } = await supabaseAdmin.storage
          .from('exports')
          .upload(objectPath, content, {
            contentType,
            upsert: true
          })

        if (sError) throw sError

        // 3. Update export row
        const { error: uError } = await supabaseAdmin
          .from('exports')
          .update({ object_path: objectPath })
          .eq('id', export_id)

        if (uError) throw uError

        console.log(`[Worker] Export ${export_id} complete for ${meeting_id} in ${format} format.`)
      }
    } catch (error: any) {
      console.error(`[Worker] Error processing job ${job.id} (${job.name}):`, error)
      
      // Store failure reason in DB
      await supabaseAdmin
        .from('meetings')
        .update({ 
          status: 'failed',
          failure_reason: error.message || 'Unknown error during background processing'
        })
        .eq('id', meeting_id)

      throw error
    }
  },
  {
    connection: {
      url: redisUrl
    } as any,
    concurrency: 5
  }
)

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`)
})

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`)
})

console.log('🚀 EdenNote Worker is running and listening for jobs...')

export default worker
