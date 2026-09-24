export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      avisos_enviados: {
        Row: {
          destinatario: string
          detalle: string | null
          fecha: string
          id: number
          resultado: string
          solicitud_id: string | null
          tipo_aviso: string
        }
        Insert: {
          destinatario: string
          detalle?: string | null
          fecha?: string
          id?: never
          resultado?: string
          solicitud_id?: string | null
          tipo_aviso: string
        }
        Update: {
          destinatario?: string
          detalle?: string | null
          fecha?: string
          id?: never
          resultado?: string
          solicitud_id?: string | null
          tipo_aviso?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_enviados_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_enviados_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_estancadas"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_estados: {
        Row: {
          estado_anterior:
            | Database["public"]["Enums"]["estado_solicitud"]
            | null
          estado_nuevo: Database["public"]["Enums"]["estado_solicitud"]
          fecha: string
          id: number
          observacion: string | null
          solicitud_id: string
          usuario_id: string | null
        }
        Insert: {
          estado_anterior?:
            | Database["public"]["Enums"]["estado_solicitud"]
            | null
          estado_nuevo: Database["public"]["Enums"]["estado_solicitud"]
          fecha?: string
          id?: never
          observacion?: string | null
          solicitud_id: string
          usuario_id?: string | null
        }
        Update: {
          estado_anterior?:
            | Database["public"]["Enums"]["estado_solicitud"]
            | null
          estado_nuevo?: Database["public"]["Enums"]["estado_solicitud"]
          fecha?: string
          id?: never
          observacion?: string | null
          solicitud_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_estados_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estados_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_estancadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          correo: string
          creado: string
          id: string
          id_estudiantil: string | null
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          correo: string
          creado?: string
          id: string
          id_estudiantil?: string | null
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          correo?: string
          creado?: string
          id?: string
          id_estudiantil?: string | null
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: []
      }
      solicitudes: {
        Row: {
          actualizada: string
          adjunto_path: string | null
          asunto: string
          creada: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_solicitud"]
          estudiante_id: string
          id: string
          motivo_revision: string | null
          observaciones: string | null
          origen: Database["public"]["Enums"]["origen_solicitud"]
          responsable_id: string | null
          revision: Database["public"]["Enums"]["estado_revision"]
          tipo: Database["public"]["Enums"]["tipo_solicitud"]
        }
        Insert: {
          actualizada?: string
          adjunto_path?: string | null
          asunto: string
          creada?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          estudiante_id?: string
          id?: string
          motivo_revision?: string | null
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          responsable_id?: string | null
          revision?: Database["public"]["Enums"]["estado_revision"]
          tipo: Database["public"]["Enums"]["tipo_solicitud"]
        }
        Update: {
          actualizada?: string
          adjunto_path?: string | null
          asunto?: string
          creada?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          estudiante_id?: string
          id?: string
          motivo_revision?: string | null
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          responsable_id?: string | null
          revision?: Database["public"]["Enums"]["estado_revision"]
          tipo?: Database["public"]["Enums"]["tipo_solicitud"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      metricas_por_estado: {
        Row: {
          estado: Database["public"]["Enums"]["estado_solicitud"] | null
          total: number | null
        }
        Relationships: []
      }
      metricas_tiempos_por_tipo: {
        Row: {
          cerradas: number | null
          horas_primera_atencion: number | null
          horas_resolucion: number | null
          tipo: Database["public"]["Enums"]["tipo_solicitud"] | null
          total: number | null
        }
        Relationships: []
      }
      solicitudes_estancadas: {
        Row: {
          actualizada: string | null
          asunto: string | null
          dias_sin_cambio: number | null
          estado: Database["public"]["Enums"]["estado_solicitud"] | null
          id: string | null
          responsable_id: string | null
          tipo: Database["public"]["Enums"]["tipo_solicitud"] | null
        }
        Insert: {
          actualizada?: string | null
          asunto?: string | null
          dias_sin_cambio?: never
          estado?: Database["public"]["Enums"]["estado_solicitud"] | null
          id?: string | null
          responsable_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_solicitud"] | null
        }
        Update: {
          actualizada?: string | null
          asunto?: string | null
          dias_sin_cambio?: never
          estado?: Database["public"]["Enums"]["estado_solicitud"] | null
          id?: string | null
          responsable_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_solicitud"] | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      dias_recordatorio: { Args: never; Returns: number }
      es_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      estado_revision: "ok" | "por_revisar"
      estado_solicitud: "pendiente" | "en_proceso" | "finalizada" | "rechazada" | "retirada"
      origen_solicitud: "web" | "correo"
      rol_usuario: "estudiante" | "admin"
      tipo_solicitud:
        | "homologacion"
        | "cancelacion_extemporanea"
        | "supletorio"
        | "reingreso"
        | "comite_curricular"
        | "otro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_revision: ["ok", "por_revisar"],
      estado_solicitud: ["pendiente", "en_proceso", "finalizada", "rechazada", "retirada"],
      origen_solicitud: ["web", "correo"],
      rol_usuario: ["estudiante", "admin"],
      tipo_solicitud: [
        "homologacion",
        "cancelacion_extemporanea",
        "supletorio",
        "reingreso",
        "comite_curricular",
        "otro",
      ],
    },
  },
} as const

