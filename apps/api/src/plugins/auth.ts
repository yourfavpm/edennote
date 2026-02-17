import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.SUPABASE_JWT_SECRET

  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not defined')
  }

  fastify.register(fastifyJwt, {
    secret
  })

  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      })
    }
  })
}

export default fp(authPlugin)
