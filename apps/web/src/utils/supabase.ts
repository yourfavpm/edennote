import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createClient = () => createBrowserSupabaseClient()

export const createServerClient = () => createServerComponentClient({ cookies })
