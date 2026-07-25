export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chapters: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publish_status"]
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_status"]
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_status"]
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_banks: {
        Row: {
          chapter_id: string | null
          created_at: string
          created_by: string | null
          extraction_error: string | null
          extraction_meta: Json | null
          extraction_status: Database["public"]["Enums"]["extraction_status"]
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          question_count: number
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          created_by?: string | null
          extraction_error?: string | null
          extraction_meta?: Json | null
          extraction_status?: Database["public"]["Enums"]["extraction_status"]
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          question_count?: number
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          created_by?: string | null
          extraction_error?: string | null
          extraction_meta?: Json | null
          extraction_status?: Database["public"]["Enums"]["extraction_status"]
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          question_count?: number
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_banks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string | null
          correct_answer: Json | null
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          explanation: string | null
          id: string
          image_url: string | null
          is_reviewed: boolean
          marks: number
          negative_marks: number
          options: Json | null
          question_bank_id: string | null
          question_number: number | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          subject_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          correct_answer?: Json | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_reviewed?: boolean
          marks?: number
          negative_marks?: number
          options?: Json | null
          question_bank_id?: string | null
          question_number?: number | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          correct_answer?: Json | null
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_reviewed?: boolean
          marks?: number
          negative_marks?: number
          options?: Json | null
          question_bank_id?: string | null
          question_number?: number | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          subject_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          accuracy: number | null
          answers: Json
          correct_count: number | null
          created_at: string
          duration_seconds: number | null
          id: string
          meta: Json | null
          obtained_marks: number | null
          passed: boolean | null
          percentage: number | null
          session_id: string | null
          skipped_count: number | null
          started_at: string
          student_email: string | null
          student_name: string | null
          submitted_at: string | null
          test_series_id: string
          total_marks: number | null
          user_id: string | null
          wrong_count: number | null
        }
        Insert: {
          accuracy?: number | null
          answers?: Json
          correct_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          meta?: Json | null
          obtained_marks?: number | null
          passed?: boolean | null
          percentage?: number | null
          session_id?: string | null
          skipped_count?: number | null
          started_at?: string
          student_email?: string | null
          student_name?: string | null
          submitted_at?: string | null
          test_series_id: string
          total_marks?: number | null
          user_id?: string | null
          wrong_count?: number | null
        }
        Update: {
          accuracy?: number | null
          answers?: Json
          correct_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          meta?: Json | null
          obtained_marks?: number | null
          passed?: boolean | null
          percentage?: number | null
          session_id?: string | null
          skipped_count?: number | null
          started_at?: string
          student_email?: string | null
          student_name?: string | null
          submitted_at?: string | null
          test_series_id?: string
          total_marks?: number | null
          user_id?: string | null
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_series_id_fkey"
            columns: ["test_series_id"]
            isOneToOne: false
            referencedRelation: "test_series"
            referencedColumns: ["id"]
          },
        ]
      }
      test_series: {
        Row: {
          attempt_count: number
          chapter_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_mix: Json | null
          duration_minutes: number
          expiry_date: string | null
          id: string
          instructions: string | null
          is_featured: boolean
          is_free: boolean
          name: string
          negative_mark_value: number
          negative_marking: boolean
          passing_marks: number
          random_questions: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          slug: string
          status: Database["public"]["Enums"]["publish_status"]
          subject_id: string | null
          total_marks: number
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          chapter_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_mix?: Json | null
          duration_minutes?: number
          expiry_date?: string | null
          id?: string
          instructions?: string | null
          is_featured?: boolean
          is_free?: boolean
          name: string
          negative_mark_value?: number
          negative_marking?: boolean
          passing_marks?: number
          random_questions?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          slug: string
          status?: Database["public"]["Enums"]["publish_status"]
          subject_id?: string | null
          total_marks?: number
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          chapter_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_mix?: Json | null
          duration_minutes?: number
          expiry_date?: string | null
          id?: string
          instructions?: string | null
          is_featured?: boolean
          is_free?: boolean
          name?: string
          negative_mark_value?: number
          negative_marking?: boolean
          passing_marks?: number
          random_questions?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["publish_status"]
          subject_id?: string | null
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_series_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_series_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      test_series_questions: {
        Row: {
          created_at: string
          id: string
          marks_override: number | null
          negative_override: number | null
          question_id: string
          sort_order: number
          test_series_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marks_override?: number | null
          negative_override?: number | null
          question_id: string
          sort_order?: number
          test_series_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marks_override?: number | null
          negative_override?: number | null
          question_id?: string
          sort_order?: number
          test_series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_series_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_series_questions_test_series_id_fkey"
            columns: ["test_series_id"]
            isOneToOne: false
            referencedRelation: "test_series"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
      difficulty_level: "easy" | "medium" | "hard"
      extraction_status: "pending" | "processing" | "completed" | "failed"
      publish_status: "draft" | "published" | "hidden"
      question_type:
        | "single_correct"
        | "multiple_correct"
        | "true_false"
        | "fill_blank"
        | "numerical"
        | "image_based"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
      difficulty_level: ["easy", "medium", "hard"],
      extraction_status: ["pending", "processing", "completed", "failed"],
      publish_status: ["draft", "published", "hidden"],
      question_type: [
        "single_correct",
        "multiple_correct",
        "true_false",
        "fill_blank",
        "numerical",
        "image_based",
      ],
    },
  },
} as const
