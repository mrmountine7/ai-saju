import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function checkPaymentStatus(userId: string, productId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('status', 'completed')
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('결제 상태 확인 오류:', error)
    return false
  }
  
  return !!data
}

export async function saveSajuResult(
  userId: string,
  profileId: string,
  analysisType: 'free' | 'premium' | 'expert',
  result: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('saju_results')
    .insert({
      user_id: userId,
      profile_id: profileId,
      analysis_type: analysisType,
      result: result,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error('분석 결과 저장 오류:', error)
    throw error
  }
  
  return data
}

export async function getSajuResults(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('saju_results')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('분석 이력 조회 오류:', error)
    throw error
  }
  
  return data
}

export default supabase
