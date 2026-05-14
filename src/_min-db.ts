// Minimal test to figure out what shape supabase-js v2.105 wants
export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: number;
          nome: string | null;
          auth_uid: string | null;
        };
        Insert: {
          id?: number;
          nome?: string | null;
          auth_uid?: string | null;
        };
        Update: {
          id?: number;
          nome?: string | null;
          auth_uid?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
