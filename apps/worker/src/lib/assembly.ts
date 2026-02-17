import axios from 'axios'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2'

if (!ASSEMBLYAI_API_KEY) {
  throw new Error('Worker: ASSEMBLYAI_API_KEY is not defined')
}

const client = axios.create({
  baseURL: ASSEMBLYAI_BASE_URL,
  headers: {
    authorization: ASSEMBLYAI_API_KEY,
    'content-type': 'application/json'
  }
})

export interface TranscriptionOptions {
  audio_url: string
  webhook_url: string
  webhook_auth_header_name: string
  webhook_auth_header_value: string
}

export async function createTranscript(options: TranscriptionOptions) {
  const response = await client.post('/transcript', {
    audio_url: options.audio_url,
    webhook_url: options.webhook_url,
    webhook_auth_header_name: options.webhook_auth_header_name,
    webhook_auth_header_value: options.webhook_auth_header_value,
    speaker_labels: true,
    punctuate: true,
    format_text: true,
    language_detection: true
  })
  return response.data
}

export async function getTranscript(transcriptId: string) {
  const response = await client.get(`/transcript/${transcriptId}`)
  return response.data
}

export async function getUtterances(transcriptId: string) {
  const response = await client.get(`/transcript/${transcriptId}/utterances`)
  return response.data
}
