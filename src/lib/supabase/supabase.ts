import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY) {
  throw new Error('Missing Supabase URL or API key')
}

const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
)

export default supabase
