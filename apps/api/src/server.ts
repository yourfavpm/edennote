import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth'
import { supabaseAdmin, getWorkspaceRole } from './lib/supabase'
import meetingRoutes from './routes/meetings'
import webhookRoutes from './routes/webhooks'
import actionRoutes from './routes/actions'
import transcriptRoutes from './routes/transcripts'
import rateLimit from '@fastify/rate-limit'

const server: FastifyInstance = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty'
    }
  }
})

// Global Error Handler
server.setErrorHandler((error: any, request: any, reply: any) => {
  server.log.error(error)
  reply.status(error.statusCode || 500).send({
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred'
    }
  })
})

const start = async () => {
  try {
    // Plugins
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    })

    await server.register(cors, {
      origin: process.env.CORS_ORIGIN || '*'
    })
    await server.register(authPlugin)

    // Routes
    await server.register(meetingRoutes, { prefix: '/v1/meetings' })
    await server.register(webhookRoutes, { prefix: '/v1/webhooks' })
    await server.register(actionRoutes, { prefix: '/v1/actions' })
    await server.register(transcriptRoutes, { prefix: '/v1/transcripts' })

    // Health Route
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    })

    // Protected Route Example
    server.get('/v1/me', { preHandler: [server.authenticate] }, async (request: any) => {
      return { user: request.user }
    })

    // Workspace Role Helper Endpoint Example
    server.get('/v1/workspaces/:id/role', { preHandler: [server.authenticate] }, async (request: any, reply) => {
      const { id: workspaceId } = request.params
      const userId = request.user.sub // Supabase UID is in the 'sub' claim

      const role = await getWorkspaceRole(userId, workspaceId)
      
      if (!role) {
        return reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'User is not a member of this workspace'
          }
        })
      }

      return { role }
    })

    const port = Number(process.env.PORT) || 3001
    await server.listen({ port, host: '0.0.0.0' })
    console.log(`🚀 EdenNote API running at http://localhost:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
