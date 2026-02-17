import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin, getWorkspaceRole } from '../lib/supabase'
import { meetingQueue } from '../lib/queue'
import { 
  CreateMeetingSchema, 
  UploadUrlSchema, 
  MarkUploadedSchema,
  ExportMeetingSchema
} from '@eden-note/shared'
import { z } from 'zod'

const meetingRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/meetings
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const validatedBody = CreateMeetingSchema.parse(request.body)
    const userId = request.user.sub

    // Check workspace role
    const role = await getWorkspaceRole(userId, validatedBody.workspace_id)
    if (!role || role === 'viewer') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }

    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .insert({
        workspace_id: validatedBody.workspace_id,
        title: validatedBody.title,
        source: validatedBody.source,
        created_by: userId,
        status: 'draft',
        recording_mime: validatedBody.recording_mime
      })
      .select()
      .single()

    if (error) throw error
    return { data: meeting }
  })

  // POST /v1/meetings/:id/upload-url
  fastify.post('/:id/upload-url', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const { file_ext, mime_type } = UploadUrlSchema.parse(request.body)
    const userId = request.user.sub

    // Get meeting to check workspace_id
    const { data: meeting, error: mError } = await supabaseAdmin
      .from('meetings')
      .select('workspace_id')
      .eq('id', meetingId)
      .single()

    if (mError || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    // Check workspace membership
    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role || role === 'viewer') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }

    const objectPath = `${meeting.workspace_id}/${meetingId}/source.${file_ext}`

    // Create signed upload URL (private bucket 'recordings')
    // NOTE: Supabase Storage createSignedUploadUrl is available on the admin client
    const { data, error: sError } = await supabaseAdmin.storage
      .from('recordings')
      .createSignedUploadUrl(objectPath)

    if (sError) throw sError

    return { 
      data: {
        upload_url: data.signedUrl,
        object_path: objectPath,
        token: data.token // Required for some upload methods if using the signed URL directly
      }
    }
  })

  // POST /v1/meetings/:id/mark-uploaded
  fastify.post('/:id/mark-uploaded', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const { object_path, recording_mime } = MarkUploadedSchema.parse(request.body)
    const userId = request.user.sub

    // Get meeting metadata
    const { data: meeting, error: mError } = await supabaseAdmin
      .from('meetings')
      .select('workspace_id, created_by')
      .eq('id', meetingId)
      .single()

    if (mError || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    // Check workspace membership or ownership
    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role || (meeting.created_by !== userId && role === 'member')) {
        // Simple logic: only creator or admin/owner can mark as uploaded
        if (role !== 'admin' && role !== 'owner') {
            return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
        }
    }

    const { data: updatedMeeting, error: uError } = await supabaseAdmin
      .from('meetings')
      .update({
        recording_object_path: object_path,
        recording_mime: recording_mime,
        status: 'uploaded'
      })
      .eq('id', meetingId)
      .select()
      .single()

    if (uError) throw uError

    return { data: updatedMeeting }
  })

  // POST /v1/meetings/:id/process
  fastify.post('/:id/process', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const userId = request.user.sub

    // Verify meeting exists and user has access
    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .select('workspace_id, status')
      .eq('id', meetingId)
      .single()

    if (error || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role || role === 'viewer') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }

    // Update status to processing
    await supabaseAdmin
      .from('meetings')
      .update({ status: 'processing' })
      .eq('id', meetingId)

    // Enqueue BullMQ job for worker
    await meetingQueue.add('start_transcription', { meeting_id: meetingId })
    
    fastify.log.info(`Enqueued meeting ${meetingId} for processing`)

    return { data: { status: 'processing' } }
  })

  // GET /v1/meetings
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { workspace_id } = z.object({ workspace_id: z.string().uuid() }).parse(request.query)
    const userId = request.user.sub

    // Check membership
    const role = await getWorkspaceRole(userId, workspace_id)
    if (!role) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    const { data: meetings, error } = await supabaseAdmin
      .from('meetings')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: meetings }
  })

  // GET /v1/meetings/:id
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const userId = request.user.sub

    // Get meeting with workspace check
    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single()

    if (error || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    // Check membership
    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    return { data: meeting }
  })

  // POST /v1/meetings/:id/exports
  fastify.post('/:id/exports', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const { format } = ExportMeetingSchema.parse(request.body)
    const userId = request.user.sub

    // Get meeting
    const { data: meeting, error: mError } = await supabaseAdmin
      .from('meetings')
      .select('workspace_id')
      .eq('id', meetingId)
      .single()

    if (mError || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    // Check membership
    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    // Create export row
    const { data: exportRow, error: eError } = await supabaseAdmin
      .from('exports')
      .insert({
        meeting_id: meetingId,
        format,
        created_by: userId,
        object_path: `pending/${meetingId}/${Date.now()}.${format}` // Temporary path
      })
      .select()
      .single()

    if (eError) throw eError

    // Enqueue export job
    await meetingQueue.add('export_meeting', { 
      meeting_id: meetingId, 
      export_id: exportRow.id,
      format 
    })

    return { data: exportRow }
  })

  // GET /v1/meetings/:id/exports
  fastify.get('/:id/exports', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const userId = request.user.sub

    // Check membership via meeting
    const { data: meeting, error: mError } = await supabaseAdmin
      .from('meetings')
      .select('workspace_id')
      .eq('id', meetingId)
      .single()

    if (mError || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    const { data: exports, error: eError } = await supabaseAdmin
      .from('exports')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })

    if (eError) throw eError

    // Generate signed URLs for each export
    const exportsWithUrls = await Promise.all((exports || []).map(async (exp) => {
      const { data: urlData } = await supabaseAdmin.storage
        .from('exports')
        .createSignedUrl(exp.object_path, 3600)
      
      return { 
        ...exp, 
        download_url: urlData?.signedUrl 
      }
    }))

    return { data: exportsWithUrls }
  })

  // POST /v1/meetings/:id/retry
  fastify.post('/:id/retry', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id: meetingId } = request.params
    const userId = request.user.sub

    // Get meeting
    const { data: meeting, error: mError } = await supabaseAdmin
      .from('meetings')
      .select('workspace_id, status, source')
      .eq('id', meetingId)
      .single()

    if (mError || !meeting) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Meeting not found' } })
    }

    if (meeting.status !== 'failed') {
      return reply.code(400).send({ error: { code: 'INVALID_STATUS', message: 'Only failed meetings can be retried' } })
    }

    // Check membership
    const role = await getWorkspaceRole(userId, meeting.workspace_id)
    if (!role || role === 'viewer') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }

    // Reset meeting status and clear failure reason
    const { error: uError } = await supabaseAdmin
      .from('meetings')
      .update({ status: 'uploaded', failure_reason: null })
      .eq('id', meetingId)

    if (uError) throw uError

    // Re-enqueue job
    await meetingQueue.add('start_transcription', { meeting_id: meetingId })

    return { data: { success: true } }
  })
}

export default meetingRoutes
