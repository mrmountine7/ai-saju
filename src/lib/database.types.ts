export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          name: string | null
          mode: 'normal' | 'expert'
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          name?: string | null
          mode?: 'normal' | 'expert'
          language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          name?: string | null
          mode?: 'normal' | 'expert'
          language?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string | null  // 비회원인 경우 null
          device_id: string | null  // 기기 ID (비회원 추적용)
          name: string
          gender: 'male' | 'female'
          nationality: 'domestic' | 'foreign'
          birth_year: number
          birth_month: number
          birth_day: number
          birth_hour: string
          calendar_type: 'solar' | 'lunar' | 'lunar_leap'
          country: string
          city: string
          is_primary: boolean
          is_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null  // 비회원인 경우 null
          device_id?: string | null  // 기기 ID (비회원 추적용)
          name: string
          gender: 'male' | 'female'
          nationality?: 'domestic' | 'foreign'
          birth_year: number
          birth_month: number
          birth_day: number
          birth_hour: string
          calendar_type?: 'solar' | 'lunar' | 'lunar_leap'
          country?: string
          city?: string
          is_primary?: boolean
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          device_id?: string | null
          name?: string
          gender?: 'male' | 'female'
          nationality?: 'domestic' | 'foreign'
          birth_year?: number
          birth_month?: number
          birth_day?: number
          birth_hour?: string
          calendar_type?: 'solar' | 'lunar' | 'lunar_leap'
          country?: string
          city?: string
          is_primary?: boolean
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      saju_results: {
        Row: {
          id: string
          profile_id: string | null
          user_id: string | null  // 회원 ID
          device_id: string | null  // 기기 ID (비회원 추적용)
          name: string | null  // 분석 대상 이름
          birth_date: string | null  // 생년월일시 문자열
          pillars: Json | null
          interpretation: Json | null
          synthesis: string | null  // AI 종합 해석
          easy_explanation: string | null  // 쉬운 설명
          classical_refs: Json | null  // 고전 문헌 참조
          daeun: Json | null
          seun: Json | null
          is_paid: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          user_id?: string | null
          device_id?: string | null
          name?: string | null
          birth_date?: string | null
          pillars?: Json | null
          interpretation?: Json | null
          synthesis?: string | null
          easy_explanation?: string | null
          classical_refs?: Json | null
          daeun?: Json | null
          seun?: Json | null
          is_paid?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          user_id?: string | null
          device_id?: string | null
          name?: string | null
          birth_date?: string | null
          pillars?: Json | null
          interpretation?: Json | null
          synthesis?: string | null
          easy_explanation?: string | null
          classical_refs?: Json | null
          daeun?: Json | null
          seun?: Json | null
          is_paid?: boolean
          created_at?: string
        }
      }
      compatibility_results: {
        Row: {
          id: string
          profile1_id: string
          profile2_id: string
          result: Json | null
          is_paid: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profile1_id: string
          profile2_id: string
          result?: Json | null
          is_paid?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          profile1_id?: string
          profile2_id?: string
          result?: Json | null
          is_paid?: boolean
          created_at?: string
        }
      }
      qa_history: {
        Row: {
          id: string
          profile_id: string | null
          compatibility_id: string | null
          question: string
          answer: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          compatibility_id?: string | null
          question: string
          answer?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          compatibility_id?: string | null
          question?: string
          answer?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          type: 'saju_detail' | 'compatibility_detail'
          reference_id: string
          amount: number
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'saju_detail' | 'compatibility_detail'
          reference_id: string
          amount: number
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'saju_detail' | 'compatibility_detail'
          reference_id?: string
          amount?: number
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
