import { Queue } from 'bullmq'
import { MeetingJobData, JobName } from '@eden-note/shared'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  throw new Error('REDIS_URL is not defined')
}

// Parse Redis URL for BullMQ
// Upstash URLs are usually redis://user:pass@host:port
// BullMQ connection options for Upstash/Redis
export const meetingQueue = new Queue<MeetingJobData, any, JobName>('meeting-processing', {
  connection: {
    url: redisUrl // Note: If standard bullmq fails here, we might need IORedis instance
  } as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
})
