import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin } from '../lib/supabase'
import { meetingQueue } from '../lib/queue'

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/webhooks/assemblyai
  fastify.post('/assemblyai', async (request: any, reply) => {
    const secret = request.headers['x-webhook-secret']
    if (secret !== process.env.ASSEMBLYAI_WEBHOOK_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { transcript_id, status, error } = request.body
    
    // Find meeting by transcript_id
    const { data: transcript, error: tError } = await supabaseAdmin
      .from('transcripts')
      .select('meeting_id')
      .eq('assemblyai_transcript_id', transcript_id)
      .single()

    if (tError || !transcript) {
      fastify.log.error(`[Webhook] Transcript not found: ${transcript_id}`)
      return reply.code(404).send({ error: 'Transcript not found' })
    }

    const meetingId = transcript.meeting_id

    if (status === 'completed') {
      fastify.log.info(`[Webhook] Transcription completed for ${meetingId}`)
      await meetingQueue.add('fetch_transcript', { 
        meeting_id: meetingId, 
        assemblyai_transcript_id: transcript_id 
      })
    } else if (status === 'error') {
      fastify.log.error(`[Webhook] Transcription failed for ${meetingId}: ${error}`)
      await supabaseAdmin
        .from('meetings')
        .update({ 
          status: 'failed',
          // Assuming we might want to store more details in a generic 'metadata' or 'error' column later
        })
        .eq('id', meetingId)
    }

    return { status: 'ok' }
  })
}

export default webhookRoutes
