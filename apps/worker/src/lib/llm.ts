import OpenAI from 'openai'
import { SummarySchema, Summary } from '@eden-note/shared'

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY
})

const MAX_CHUNK_LENGTH = 10000 // approx 2500 tokens

export async function summarizeMeeting(title: string, transcript: string): Promise<Summary> {
  const chunks = chunkText(transcript, MAX_CHUNK_LENGTH)
  
  let summaries = []
  if (chunks.length > 1) {
    console.log(`[LLM] Transcript long (${transcript.length} chars). Chunking into ${chunks.length} parts.`)
    for (let i = 0; i < chunks.length; i++) {
      const chunkSummary = await summarizeChunk(chunks[i], i + 1, chunks.length)
      summaries.push(chunkSummary)
    }
  } else {
    summaries = [transcript]
  }

  const finalJson = await mergeSummaries(title, summaries)
  
  // Validation and automatic retry
  try {
    return SummarySchema.parse(finalJson)
  } catch (error: any) {
    console.warn(`[LLM] Validation failed, retrying once with fix prompt...`)
    const fixedJson = await fixJson(finalJson, error.message)
    return SummarySchema.parse(fixedJson)
  }
}

function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  let current = 0
  while (current < text.length) {
    chunks.push(text.substring(current, current + maxLength))
    current += maxLength
  }
  return chunks
}

async function summarizeChunk(text: string, index: number, total: number): Promise<string> {
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are an expert meeting assistant. Summarize this part of a meeting. Focus on core discussions, decisions, and outcomes.' },
      { role: 'user', content: `Part ${index}/${total} of meeting transcript:\n\n${text}` }
    ]
  })
  return response.choices[0].message.content || ''
}

async function mergeSummaries(title: string, summaries: string[]): Promise<any> {
  const combined = summaries.join('\n\n---\n\n')
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
    messages: [
      { 
        role: 'system', 
        content: `You are an expert meeting assistant. Create a comprehensive JSON summary of the meeting titled "${title}".
        You MUST provide a valid JSON object matching the following structure:
        {
          "executive_summary": "High level overview",
          "bullet_summary": ["Point 1", "Point 2"],
          "decisions": [{"decision": "...", "owner": "...", "timestamp_seconds": 0, "quote": "..."}],
          "action_items": [{"task": "...", "owner": "...", "due_date": "...", "confidence": 0.95, "timestamp_seconds": 0, "quote": "..."}],
          "topics": [{"title": "...", "start_time_seconds": 0, "summary": "...", "key_quotes": [{"quote": "...", "speaker": "...", "timestamp_seconds": 0}]}],
          "risks": ["Risk 1"],
          "questions": ["Question 1"]
        }
        Confidence mapping: 0 to 1.
        `
      },
      { role: 'user', content: `Summaries to merge:\n\n${combined}` }
    ],
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('LLM returned empty content')
  return JSON.parse(content)
}

async function fixJson(invalidJson: any, errorMessage: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
    messages: [
      { 
        role: 'system', 
        content: `You are a JSON fixer. The following JSON failed Zod validation. Fix it to match the schema exactly.
        The error was: ${errorMessage}
        Output ONLY the valid JSON.`
      },
      { role: 'user', content: JSON.stringify(invalidJson) }
    ],
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('LLM failed to fix JSON')
  return JSON.parse(content)
}
