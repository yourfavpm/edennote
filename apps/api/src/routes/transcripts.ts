import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin, getWorkspaceRole } from '../lib/supabase'
import { z } from 'zod'

const transcriptRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /v1/transcripts/:id
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id } = request.params
    const { text_long } = z.object({ text_long: z.string().min(1) }).parse(request.body)
    const userId = request.user.sub

    // Get transcript to find meeting -> workspace_id
    const { data: transcript, error: tError } = await supabaseAdmin
      .from('transcripts')
      .select('meeting_id, meetings(workspace_id)')
      .eq('id', id)
      .single()

    if (tError || !transcript) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Transcript not found' } })
    }

    const workspaceId = (transcript as any).meetings.workspace_id

    // Check workspace membership
    const role = await getWorkspaceRole(userId, workspaceId)
    if (!role || role === 'viewer') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }

    const { data: updatedTranscript, error: uError } = await supabaseAdmin
      .from('transcripts')
      .update({ text_long })
      .eq('id', id)
      .select()
      .single()

    if (uError) throw uError
    return { data: updatedTranscript }
  })
}

export default transcriptRoutes
