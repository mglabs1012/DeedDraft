// Schema-mirrored fallback. Replace with Supabase CLI output after signing in.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      firms: Table<
        { id: string; name: string; city: string; state: string; bar_registration_no: string | null; created_at: string },
        { id?: string; name: string; city: string; state?: string; bar_registration_no?: string | null; created_at?: string },
        { id?: string; name?: string; city?: string; state?: string; bar_registration_no?: string | null; created_at?: string }
      >;
      profiles: Table<
        { id: string; full_name: string; phone: string | null; created_at: string },
        { id: string; full_name: string; phone?: string | null; created_at?: string },
        { id?: string; full_name?: string; phone?: string | null; created_at?: string }
      >;
      firm_members: Table<
        { id: string; firm_id: string; user_id: string; role: Database["public"]["Enums"]["member_role"]; created_at: string },
        { id?: string; firm_id: string; user_id: string; role?: Database["public"]["Enums"]["member_role"]; created_at?: string },
        { id?: string; firm_id?: string; user_id?: string; role?: Database["public"]["Enums"]["member_role"]; created_at?: string }
      >;
      deeds: Table<
        { id: string; firm_id: string; deed_type: Database["public"]["Enums"]["deed_type"]; title: string; reference_no: string; language: Database["public"]["Enums"]["deed_language"]; status: Database["public"]["Enums"]["deed_status"]; data: Json; remarks: string | null; created_by: string; created_at: string; updated_at: string },
        { id?: string; firm_id: string; deed_type: Database["public"]["Enums"]["deed_type"]; title: string; reference_no?: string; language?: Database["public"]["Enums"]["deed_language"]; status?: Database["public"]["Enums"]["deed_status"]; data?: Json; remarks?: string | null; created_by: string; created_at?: string; updated_at?: string },
        { id?: string; firm_id?: string; deed_type?: Database["public"]["Enums"]["deed_type"]; title?: string; reference_no?: string; language?: Database["public"]["Enums"]["deed_language"]; status?: Database["public"]["Enums"]["deed_status"]; data?: Json; remarks?: string | null; created_by?: string; created_at?: string; updated_at?: string }
      >;
      deed_documents: Table<
        { id: string; deed_id: string; firm_id: string; category: Database["public"]["Enums"]["document_category"]; file_name: string; storage_path: string; mime_type: string; size_bytes: number; uploaded_by: string; created_at: string },
        { id?: string; deed_id: string; firm_id: string; category?: Database["public"]["Enums"]["document_category"]; file_name: string; storage_path: string; mime_type: string; size_bytes: number; uploaded_by: string; created_at?: string },
        { id?: string; deed_id?: string; firm_id?: string; category?: Database["public"]["Enums"]["document_category"]; file_name?: string; storage_path?: string; mime_type?: string; size_bytes?: number; uploaded_by?: string; created_at?: string }
      >;
      activity_log: Table<
        { id: string; firm_id: string; deed_id: string | null; user_id: string; action: string; details: Json; created_at: string },
        { id?: string; firm_id: string; deed_id?: string | null; user_id: string; action: string; details?: Json; created_at?: string },
        { id?: string; firm_id?: string; deed_id?: string | null; user_id?: string; action?: string; details?: Json; created_at?: string }
      >;
      firm_deed_counters: Table<
        { firm_id: string; reference_year: number; last_number: number },
        { firm_id: string; reference_year: number; last_number?: number },
        { firm_id?: string; reference_year?: number; last_number?: number }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_firm_workspace: { Args: { p_full_name: string; p_phone: string; p_firm_name: string; p_city: string }; Returns: string };
      is_firm_member: { Args: { target_firm_id: string }; Returns: boolean };
      is_firm_owner: { Args: { target_firm_id: string }; Returns: boolean };
      shares_firm_with: { Args: { target_user_id: string }; Returns: boolean };
    };
    Enums: {
      deed_type: "sale" | "release" | "gift" | "partition" | "will" | "other";
      deed_status: "draft" | "data_collection" | "under_review" | "generated" | "finalized";
      deed_language: "english" | "hindi" | "bilingual";
      member_role: "owner" | "advocate" | "clerk";
      document_category: "naksha_map" | "id_proof" | "prior_title_deed" | "jamabandi" | "payment_proof" | "photograph" | "other";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Deed = Database["public"]["Tables"]["deeds"]["Row"];
export type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type FirmMember = Database["public"]["Tables"]["firm_members"]["Row"];
