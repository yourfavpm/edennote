import { FastifyPluginAsync } from 'fastify'
import { supabaseAdmin, getWorkspaceRole } from '../lib/supabase'
import { z } from 'zod'

const actionRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /v1/actions/:id
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id } = request.params
    const { status } = z.object({ status: z.enum(['open', 'done']) }).parse(request.body)
    const userId = request.user.sub

    // Get action to find workspace_id
    const { data: action, error: aError } = await supabaseAdmin
      .from('actions')
      .select('workspace_id')
      .eq('id', id)
      .single()

    if (aError || !action) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Action item not found' } })
    }

    // Check workspace membership
    const role = await getWorkspaceRole(userId, action.workspace_id)
    if (!role || role === 'viewer') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }

    const { data: updatedAction, error: uError } = await supabaseAdmin
      .from('actions')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (uError) throw uError
    return { data: updatedAction }
  })

  // GET /v1/actions
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { workspace_id } = z.object({ workspace_id: z.string().uuid() }).parse(request.query)
    const userId = request.user.sub

    // Check membership
    const role = await getWorkspaceRole(userId, workspace_id)
    if (!role) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    const { data: actions, error } = await supabaseAdmin
      .from('actions')
      .select('*, meetings(title)')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: actions }
  })
}

export default actionRoutes
