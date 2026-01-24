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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          attaque1: string | null
          attaque2: string | null
          created_at: string | null
          game_id: string
          id: string
          manche: number
          num_joueur: number
          position_souhaitee: number | null
          protection_objet: string | null
          session_game_id: string | null
          slot_attaque: number | null
          slot_protection: number | null
        }
        Insert: {
          attaque1?: string | null
          attaque2?: string | null
          created_at?: string | null
          game_id: string
          id?: string
          manche: number
          num_joueur: number
          position_souhaitee?: number | null
          protection_objet?: string | null
          session_game_id?: string | null
          slot_attaque?: number | null
          slot_protection?: number | null
        }
        Update: {
          attaque1?: string | null
          attaque2?: string | null
          created_at?: string | null
          game_id?: string
          id?: string
          manche?: number
          num_joueur?: number
          position_souhaitee?: number | null
          protection_objet?: string | null
          session_game_id?: string | null
          slot_attaque?: number | null
          slot_protection?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_actions_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          performed_by_email: string
          target_user_email: string
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by: string
          performed_by_email: string
          target_user_email: string
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          performed_by_email?: string
          target_user_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      adventure_scores: {
        Row: {
          breakdown: Json | null
          game_player_id: string
          id: string
          session_id: string
          total_score_value: number
          updated_at: string
        }
        Insert: {
          breakdown?: Json | null
          game_player_id: string
          id?: string
          session_id: string
          total_score_value?: number
          updated_at?: string
        }
        Update: {
          breakdown?: Json | null
          game_player_id?: string
          id?: string
          session_id?: string
          total_score_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_scores_game_player_id_fkey"
            columns: ["game_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      adventure_steps: {
        Row: {
          adventure_id: string
          created_at: string
          custom_starting_tokens: number | null
          default_step_config: Json | null
          game_type_code: string
          id: string
          step_index: number
          token_policy: string
        }
        Insert: {
          adventure_id: string
          created_at?: string
          custom_starting_tokens?: number | null
          default_step_config?: Json | null
          game_type_code: string
          id?: string
          step_index: number
          token_policy?: string
        }
        Update: {
          adventure_id?: string
          created_at?: string
          custom_starting_tokens?: number | null
          default_step_config?: Json | null
          game_type_code?: string
          id?: string
          step_index?: number
          token_policy?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventure_steps_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adventure_steps_game_type_code_fkey"
            columns: ["game_type_code"]
            isOneToOne: false
            referencedRelation: "game_types"
            referencedColumns: ["code"]
          },
        ]
      }
      adventures: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      battlefield: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          monstre_id_en_place: number | null
          pv_miroir: number | null
          session_game_id: string | null
          slot: number
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          monstre_id_en_place?: number | null
          pv_miroir?: number | null
          session_game_id?: string | null
          slot: number
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          monstre_id_en_place?: number | null
          pv_miroir?: number | null
          session_game_id?: string | null
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "battlefield_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_battlefield_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_config: {
        Row: {
          categorie: string | null
          cible: string | null
          conso_objet: boolean | null
          created_at: string | null
          degats_base: number | null
          effet_special: string | null
          game_id: string | null
          id: string
          ignore_protection: boolean | null
          notes: string | null
          objet: string
          persistance: string | null
          session_game_id: string | null
          soin_base: number | null
          timing: string | null
        }
        Insert: {
          categorie?: string | null
          cible?: string | null
          conso_objet?: boolean | null
          created_at?: string | null
          degats_base?: number | null
          effet_special?: string | null
          game_id?: string | null
          id?: string
          ignore_protection?: boolean | null
          notes?: string | null
          objet: string
          persistance?: string | null
          session_game_id?: string | null
          soin_base?: number | null
          timing?: string | null
        }
        Update: {
          categorie?: string | null
          cible?: string | null
          conso_objet?: boolean | null
          created_at?: string | null
          degats_base?: number | null
          effet_special?: string | null
          game_id?: string | null
          id?: string
          ignore_protection?: boolean | null
          notes?: string | null
          objet?: string
          persistance?: string | null
          session_game_id?: string | null
          soin_base?: number | null
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combat_config_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_config_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_results: {
        Row: {
          created_at: string
          forest_state: Json | null
          game_id: string
          id: string
          kills: Json
          manche: number
          mj_summary: Json
          public_summary: Json
          resolved_at: string
          session_game_id: string | null
        }
        Insert: {
          created_at?: string
          forest_state?: Json | null
          game_id: string
          id?: string
          kills?: Json
          manche: number
          mj_summary?: Json
          public_summary?: Json
          resolved_at?: string
          session_game_id?: string | null
        }
        Update: {
          created_at?: string
          forest_state?: Json | null
          game_id?: string
          id?: string
          kills?: Json
          manche?: number
          mj_summary?: Json
          public_summary?: Json
          resolved_at?: string
          session_game_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combat_results_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_results_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      event_expense_items: {
        Row: {
          created_at: string
          expense_type: string
          id: string
          label: string
          meetup_event_id: string
          notes: string | null
          order_date: string | null
          qty_optimiste: number | null
          qty_pessimiste: number | null
          qty_probable: number | null
          qty_real: number | null
          real_unit_cost: number | null
          state: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expense_type: string
          id?: string
          label: string
          meetup_event_id: string
          notes?: string | null
          order_date?: string | null
          qty_optimiste?: number | null
          qty_pessimiste?: number | null
          qty_probable?: number | null
          qty_real?: number | null
          real_unit_cost?: number | null
          state?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expense_type?: string
          id?: string
          label?: string
          meetup_event_id?: string
          notes?: string | null
          order_date?: string | null
          qty_optimiste?: number | null
          qty_pessimiste?: number | null
          qty_probable?: number | null
          qty_real?: number | null
          real_unit_cost?: number | null
          state?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_expense_items_meetup_event_id_fkey"
            columns: ["meetup_event_id"]
            isOneToOne: false
            referencedRelation: "meetup_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_financial_settings: {
        Row: {
          created_at: string
          inscription_price: number | null
          inscriptions_optimiste: number | null
          inscriptions_pessimiste: number | null
          inscriptions_probable: number | null
          inscriptions_real: number | null
          investment_budget: number | null
          meetup_event_id: string
          opening_balance: number | null
          parking_optimiste: number | null
          parking_pessimiste: number | null
          parking_price: number | null
          parking_probable: number | null
          parking_real: number | null
          scenario_active: Database["public"]["Enums"]["budget_scenario"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          inscription_price?: number | null
          inscriptions_optimiste?: number | null
          inscriptions_pessimiste?: number | null
          inscriptions_probable?: number | null
          inscriptions_real?: number | null
          investment_budget?: number | null
          meetup_event_id: string
          opening_balance?: number | null
          parking_optimiste?: number | null
          parking_pessimiste?: number | null
          parking_price?: number | null
          parking_probable?: number | null
          parking_real?: number | null
          scenario_active?: Database["public"]["Enums"]["budget_scenario"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          inscription_price?: number | null
          inscriptions_optimiste?: number | null
          inscriptions_pessimiste?: number | null
          inscriptions_probable?: number | null
          inscriptions_real?: number | null
          investment_budget?: number | null
          meetup_event_id?: string
          opening_balance?: number | null
          parking_optimiste?: number | null
          parking_pessimiste?: number | null
          parking_price?: number | null
          parking_probable?: number | null
          parking_real?: number | null
          scenario_active?: Database["public"]["Enums"]["budget_scenario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_financial_settings_meetup_event_id_fkey"
            columns: ["meetup_event_id"]
            isOneToOne: true
            referencedRelation: "meetup_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invites: {
        Row: {
          address: string | null
          cash_box: string | null
          contributed_amount: number | null
          created_at: string
          email: string | null
          followup_date: string | null
          full_name: string
          id: string
          invite_status: Database["public"]["Enums"]["invite_status"]
          invited_by: string | null
          meetup_event_id: string
          notes: string | null
          pack_label: string | null
          parking_amount: number | null
          phone: string | null
          profiles: string | null
          registration_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          cash_box?: string | null
          contributed_amount?: number | null
          created_at?: string
          email?: string | null
          followup_date?: string | null
          full_name: string
          id?: string
          invite_status?: Database["public"]["Enums"]["invite_status"]
          invited_by?: string | null
          meetup_event_id: string
          notes?: string | null
          pack_label?: string | null
          parking_amount?: number | null
          phone?: string | null
          profiles?: string | null
          registration_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          cash_box?: string | null
          contributed_amount?: number | null
          created_at?: string
          email?: string | null
          followup_date?: string | null
          full_name?: string
          id?: string
          invite_status?: Database["public"]["Enums"]["invite_status"]
          invited_by?: string | null
          meetup_event_id?: string
          notes?: string | null
          pack_label?: string | null
          parking_amount?: number | null
          phone?: string | null
          profiles?: string | null
          registration_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_invites_meetup_event_id_fkey"
            columns: ["meetup_event_id"]
            isOneToOne: false
            referencedRelation: "meetup_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invites_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "meetup_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          meetup_event_id: string
          notes: string | null
          owner_label: string | null
          owner_user_id: string | null
          stage: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          meetup_event_id: string
          notes?: string | null
          owner_label?: string | null
          owner_user_id?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          meetup_event_id?: string
          notes?: string | null
          owner_label?: string | null
          owner_user_id?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_meetup_event_id_fkey"
            columns: ["meetup_event_id"]
            isOneToOne: false
            referencedRelation: "meetup_events"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string
          payload: Json | null
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string
          payload?: Json | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          payload?: Json | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      game_events: {
        Row: {
          created_at: string
          event_type: string
          game_id: string
          id: string
          manche: number
          message: string
          payload: Json | null
          phase: string
          player_id: string | null
          player_num: number | null
          session_game_id: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          event_type: string
          game_id: string
          id?: string
          manche?: number
          message: string
          payload?: Json | null
          phase?: string
          player_id?: string | null
          player_num?: number | null
          session_game_id?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          game_id?: string
          id?: string
          manche?: number
          message?: string
          payload?: Json | null
          phase?: string
          player_id?: string | null
          player_num?: number | null
          session_game_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_events_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invitations: {
        Row: {
          created_at: string
          game_id: string
          game_name: string
          id: string
          invited_by_user_id: string
          invited_user_id: string
          join_code: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          game_id: string
          game_name: string
          id?: string
          invited_by_user_id: string
          invited_user_id: string
          join_code: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          game_name?: string
          id?: string
          invited_by_user_id?: string
          invited_user_id?: string
          join_code?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invitations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_item_purchases: {
        Row: {
          cost: number
          created_at: string
          game_id: string
          id: string
          item_name: string
          manche: number
          player_id: string
          player_num: number
          purchased_at: string
          resolved_at: string | null
          resolved_by: string | null
          session_game_id: string | null
          status: string
        }
        Insert: {
          cost: number
          created_at?: string
          game_id: string
          id?: string
          item_name: string
          manche: number
          player_id: string
          player_num: number
          purchased_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_game_id?: string | null
          status?: string
        }
        Update: {
          cost?: number
          created_at?: string
          game_id?: string
          id?: string
          item_name?: string
          manche?: number
          player_id?: string
          player_num?: number
          purchased_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_game_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_item_purchases_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_item_purchases_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_monsters: {
        Row: {
          created_at: string
          game_id: string
          id: string
          initial_status: Database["public"]["Enums"]["monster_initial_status"]
          is_enabled: boolean
          monster_id: number
          order_index: number
          pv_max_override: number | null
          reward_override: number | null
          session_game_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          initial_status?: Database["public"]["Enums"]["monster_initial_status"]
          is_enabled?: boolean
          monster_id: number
          order_index?: number
          pv_max_override?: number | null
          reward_override?: number | null
          session_game_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          initial_status?: Database["public"]["Enums"]["monster_initial_status"]
          is_enabled?: boolean
          monster_id?: number
          order_index?: number
          pv_max_override?: number | null
          reward_override?: number | null
          session_game_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_monsters_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_monsters_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_monsters_monster_id_fkey"
            columns: ["monster_id"]
            isOneToOne: false
            referencedRelation: "monster_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          clan: string | null
          clan_locked: boolean | null
          clan_token_used: boolean | null
          device_id: string | null
          display_name: string
          game_id: string
          has_antibodies: boolean | null
          id: string
          immune_permanent: boolean | null
          infected_at_manche: number | null
          is_alive: boolean | null
          is_bot: boolean
          is_carrier: boolean | null
          is_contagious: boolean | null
          is_host: boolean
          jetons: number | null
          joined_at: string
          last_seen: string | null
          mate_num: number | null
          player_number: number | null
          player_token: string | null
          pvic: number | null
          recompenses: number | null
          removed_at: string | null
          removed_by: string | null
          removed_reason: string | null
          role_code: string | null
          status: string | null
          team_code: string | null
          user_id: string | null
          will_contaminate_at_manche: number | null
          will_die_at_manche: number | null
        }
        Insert: {
          clan?: string | null
          clan_locked?: boolean | null
          clan_token_used?: boolean | null
          device_id?: string | null
          display_name: string
          game_id: string
          has_antibodies?: boolean | null
          id?: string
          immune_permanent?: boolean | null
          infected_at_manche?: number | null
          is_alive?: boolean | null
          is_bot?: boolean
          is_carrier?: boolean | null
          is_contagious?: boolean | null
          is_host?: boolean
          jetons?: number | null
          joined_at?: string
          last_seen?: string | null
          mate_num?: number | null
          player_number?: number | null
          player_token?: string | null
          pvic?: number | null
          recompenses?: number | null
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          role_code?: string | null
          status?: string | null
          team_code?: string | null
          user_id?: string | null
          will_contaminate_at_manche?: number | null
          will_die_at_manche?: number | null
        }
        Update: {
          clan?: string | null
          clan_locked?: boolean | null
          clan_token_used?: boolean | null
          device_id?: string | null
          display_name?: string
          game_id?: string
          has_antibodies?: boolean | null
          id?: string
          immune_permanent?: boolean | null
          infected_at_manche?: number | null
          is_alive?: boolean | null
          is_bot?: boolean
          is_carrier?: boolean | null
          is_contagious?: boolean | null
          is_host?: boolean
          jetons?: number | null
          joined_at?: string
          last_seen?: string | null
          mate_num?: number | null
          player_number?: number | null
          player_token?: string | null
          pvic?: number | null
          recompenses?: number | null
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          role_code?: string | null
          status?: string | null
          team_code?: string | null
          user_id?: string | null
          will_contaminate_at_manche?: number | null
          will_die_at_manche?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_shop_offers: {
        Row: {
          created_at: string
          game_id: string
          generated_at: string
          id: string
          item_ids: string[]
          locked: boolean
          manche: number
          resolved: boolean
          resolved_at: string | null
          session_game_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          generated_at?: string
          id?: string
          item_ids?: string[]
          locked?: boolean
          manche: number
          resolved?: boolean
          resolved_at?: string | null
          session_game_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          generated_at?: string
          id?: string
          item_ids?: string[]
          locked?: boolean
          manche?: number
          resolved?: boolean
          resolved_at?: string | null
          session_game_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_shop_offers_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_shop_offers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state_monsters: {
        Row: {
          battlefield_slot: number | null
          created_at: string
          game_id: string
          id: string
          monster_id: number
          pv_current: number
          session_game_id: string | null
          status: Database["public"]["Enums"]["monster_runtime_status"]
          updated_at: string
        }
        Insert: {
          battlefield_slot?: number | null
          created_at?: string
          game_id: string
          id?: string
          monster_id: number
          pv_current: number
          session_game_id?: string | null
          status?: Database["public"]["Enums"]["monster_runtime_status"]
          updated_at?: string
        }
        Update: {
          battlefield_slot?: number | null
          created_at?: string
          game_id?: string
          id?: string
          monster_id?: number
          pv_current?: number
          session_game_id?: string | null
          status?: Database["public"]["Enums"]["monster_runtime_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_state_monsters_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_monsters_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_monsters_monster_id_fkey"
            columns: ["monster_id"]
            isOneToOne: false
            referencedRelation: "monster_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      game_types: {
        Row: {
          code: string
          created_at: string
          default_config: Json | null
          default_starting_tokens: number | null
          description: string | null
          is_active: boolean
          name: string
          status: Database["public"]["Enums"]["game_type_status"]
        }
        Insert: {
          code: string
          created_at?: string
          default_config?: Json | null
          default_starting_tokens?: number | null
          description?: string | null
          is_active?: boolean
          name: string
          status?: Database["public"]["Enums"]["game_type_status"]
        }
        Update: {
          code?: string
          created_at?: string
          default_config?: Json | null
          default_starting_tokens?: number | null
          description?: string | null
          is_active?: boolean
          name?: string
          status?: Database["public"]["Enums"]["game_type_status"]
        }
        Relationships: []
      }
      games: {
        Row: {
          adventure_id: string | null
          created_at: string
          current_session_game_id: string | null
          current_step_index: number
          host_user_id: string
          id: string
          is_public: boolean
          join_code: string
          manche_active: number | null
          mode: string
          name: string
          phase: string
          phase_locked: boolean
          selected_game_type_code: string | null
          sens_depart_egalite: string | null
          starting_tokens: number
          status: string
          winner_declared: boolean
          x_nb_joueurs: number | null
        }
        Insert: {
          adventure_id?: string | null
          created_at?: string
          current_session_game_id?: string | null
          current_step_index?: number
          host_user_id: string
          id?: string
          is_public?: boolean
          join_code: string
          manche_active?: number | null
          mode?: string
          name?: string
          phase?: string
          phase_locked?: boolean
          selected_game_type_code?: string | null
          sens_depart_egalite?: string | null
          starting_tokens?: number
          status?: string
          winner_declared?: boolean
          x_nb_joueurs?: number | null
        }
        Update: {
          adventure_id?: string | null
          created_at?: string
          current_session_game_id?: string | null
          current_step_index?: number
          host_user_id?: string
          id?: string
          is_public?: boolean
          join_code?: string
          manche_active?: number | null
          mode?: string
          name?: string
          phase?: string
          phase_locked?: boolean
          selected_game_type_code?: string | null
          sens_depart_egalite?: string | null
          starting_tokens?: number
          status?: string
          winner_declared?: boolean
          x_nb_joueurs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_games_current_session_game"
            columns: ["current_session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_adventure_id_fkey"
            columns: ["adventure_id"]
            isOneToOne: false
            referencedRelation: "adventures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_selected_game_type_code_fkey"
            columns: ["selected_game_type_code"]
            isOneToOne: false
            referencedRelation: "game_types"
            referencedColumns: ["code"]
          },
        ]
      }
      infection_chat_messages: {
        Row: {
          author_name: string
          author_num: number
          channel_key: string
          channel_type: string
          created_at: string | null
          game_id: string
          id: string
          manche: number | null
          message: string
          session_game_id: string
        }
        Insert: {
          author_name: string
          author_num: number
          channel_key: string
          channel_type: string
          created_at?: string | null
          game_id: string
          id?: string
          manche?: number | null
          message: string
          session_game_id: string
        }
        Update: {
          author_name?: string
          author_num?: number
          channel_key?: string
          channel_type?: string
          created_at?: string | null
          game_id?: string
          id?: string
          manche?: number | null
          message?: string
          session_game_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "infection_chat_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infection_chat_messages_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      infection_inputs: {
        Row: {
          ae_sabotage_target_num: number | null
          ba_shot_target_num: number | null
          corruption_amount: number | null
          created_at: string | null
          game_id: string
          id: string
          manche: number
          oc_lookup_target_num: number | null
          player_id: string
          player_num: number
          pv_antidote_target_num: number | null
          pv_patient0_target_num: number | null
          pv_shot_target_num: number | null
          session_game_id: string
          sy_research_target_num: number | null
          updated_at: string | null
          vote_suspect_pv_target_num: number | null
          vote_test_target_num: number | null
        }
        Insert: {
          ae_sabotage_target_num?: number | null
          ba_shot_target_num?: number | null
          corruption_amount?: number | null
          created_at?: string | null
          game_id: string
          id?: string
          manche: number
          oc_lookup_target_num?: number | null
          player_id: string
          player_num: number
          pv_antidote_target_num?: number | null
          pv_patient0_target_num?: number | null
          pv_shot_target_num?: number | null
          session_game_id: string
          sy_research_target_num?: number | null
          updated_at?: string | null
          vote_suspect_pv_target_num?: number | null
          vote_test_target_num?: number | null
        }
        Update: {
          ae_sabotage_target_num?: number | null
          ba_shot_target_num?: number | null
          corruption_amount?: number | null
          created_at?: string | null
          game_id?: string
          id?: string
          manche?: number
          oc_lookup_target_num?: number | null
          player_id?: string
          player_num?: number
          pv_antidote_target_num?: number | null
          pv_patient0_target_num?: number | null
          pv_shot_target_num?: number | null
          session_game_id?: string
          sy_research_target_num?: number | null
          updated_at?: string | null
          vote_suspect_pv_target_num?: number | null
          vote_test_target_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "infection_inputs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infection_inputs_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      infection_round_state: {
        Row: {
          config: Json | null
          created_at: string | null
          game_id: string
          id: string
          locked_at: string | null
          manche: number
          opened_at: string | null
          resolved_at: string | null
          session_game_id: string
          status: string
          sy_required_success: number | null
          sy_success_count: number | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          game_id: string
          id?: string
          locked_at?: string | null
          manche: number
          opened_at?: string | null
          resolved_at?: string | null
          session_game_id: string
          status?: string
          sy_required_success?: number | null
          sy_success_count?: number | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          game_id?: string
          id?: string
          locked_at?: string | null
          manche?: number
          opened_at?: string | null
          resolved_at?: string | null
          session_game_id?: string
          status?: string
          sy_required_success?: number | null
          sy_success_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "infection_round_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infection_round_state_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      infection_shots: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          ignore_reason: string | null
          manche: number
          server_ts: string
          session_game_id: string
          shooter_num: number
          shooter_role: string
          status: string
          target_num: number
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          ignore_reason?: string | null
          manche: number
          server_ts?: string
          session_game_id: string
          shooter_num: number
          shooter_role: string
          status?: string
          target_num: number
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          ignore_reason?: string | null
          manche?: number
          server_ts?: string
          session_game_id?: string
          shooter_num?: number
          shooter_role?: string
          status?: string
          target_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "infection_shots_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infection_shots_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string | null
          dispo_attaque: boolean | null
          disponible: boolean | null
          game_id: string
          id: string
          objet: string
          owner_num: number | null
          quantite: number | null
          session_game_id: string | null
        }
        Insert: {
          created_at?: string | null
          dispo_attaque?: boolean | null
          disponible?: boolean | null
          game_id: string
          id?: string
          objet: string
          owner_num?: number | null
          quantite?: number | null
          session_game_id?: string | null
        }
        Update: {
          created_at?: string | null
          dispo_attaque?: boolean | null
          disponible?: boolean | null
          game_id?: string
          id?: string
          objet?: string
          owner_num?: number | null
          quantite?: number | null
          session_game_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      item_catalog: {
        Row: {
          base_damage: number | null
          base_heal: number | null
          category: Database["public"]["Enums"]["item_category"]
          consumable: boolean | null
          created_at: string
          detailed_description: string | null
          id: string
          ignore_protection: boolean | null
          name: string
          notes: string | null
          persistence: string | null
          purchasable: boolean | null
          restockable: boolean
          special_effect: string | null
          special_value: string | null
          target: string | null
          timing: string | null
        }
        Insert: {
          base_damage?: number | null
          base_heal?: number | null
          category: Database["public"]["Enums"]["item_category"]
          consumable?: boolean | null
          created_at?: string
          detailed_description?: string | null
          id?: string
          ignore_protection?: boolean | null
          name: string
          notes?: string | null
          persistence?: string | null
          purchasable?: boolean | null
          restockable?: boolean
          special_effect?: string | null
          special_value?: string | null
          target?: string | null
          timing?: string | null
        }
        Update: {
          base_damage?: number | null
          base_heal?: number | null
          category?: Database["public"]["Enums"]["item_category"]
          consumable?: boolean | null
          created_at?: string
          detailed_description?: string | null
          id?: string
          ignore_protection?: boolean | null
          name?: string
          notes?: string | null
          persistence?: string | null
          purchasable?: boolean | null
          restockable?: boolean
          special_effect?: string | null
          special_value?: string | null
          target?: string | null
          timing?: string | null
        }
        Relationships: []
      }
      lobby_chat_messages: {
        Row: {
          created_at: string
          game_id: string
          id: string
          message: string
          sender_name: string
          sender_num: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          message: string
          sender_name: string
          sender_num: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          message?: string
          sender_name?: string
          sender_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "lobby_chat_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          logged_in_at: string
          os: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          os?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          os?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      logs_joueurs: {
        Row: {
          game_id: string
          id: string
          log_index: number
          manche: number | null
          message: string | null
          session_game_id: string | null
          timestamp: string | null
          type: string | null
        }
        Insert: {
          game_id: string
          id?: string
          log_index?: number
          manche?: number | null
          message?: string | null
          session_game_id?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Update: {
          game_id?: string
          id?: string
          log_index?: number
          manche?: number | null
          message?: string | null
          session_game_id?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_logs_joueurs_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_joueurs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_mj: {
        Row: {
          action: string
          details: string | null
          game_id: string
          id: string
          manche: number | null
          num_joueur: number | null
          session_game_id: string | null
          timestamp: string | null
        }
        Insert: {
          action: string
          details?: string | null
          game_id: string
          id?: string
          manche?: number | null
          num_joueur?: number | null
          session_game_id?: string | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          details?: string | null
          game_id?: string
          id?: string
          manche?: number | null
          num_joueur?: number | null
          session_game_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_logs_mj_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_mj_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          amount: number
          created_at: string
          granted_by: string | null
          id: string
          note: string | null
          source: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          source: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          source?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      meetup_events: {
        Row: {
          audio_url: string | null
          city: string
          cover_image_url: string | null
          created_at: string
          description: string
          end_at: string
          expected_players: number
          id: string
          pot_contribution_eur: number
          pot_potential_eur: number
          price_eur: number
          slug: string
          start_at: string
          status: string
          title: string
          venue: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          city: string
          cover_image_url?: string | null
          created_at?: string
          description: string
          end_at: string
          expected_players?: number
          id?: string
          pot_contribution_eur?: number
          pot_potential_eur?: number
          price_eur?: number
          slug: string
          start_at: string
          status?: string
          title: string
          venue?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          end_at?: string
          expected_players?: number
          id?: string
          pot_contribution_eur?: number
          pot_potential_eur?: number
          price_eur?: number
          slug?: string
          start_at?: string
          status?: string
          title?: string
          venue?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      meetup_registrations: {
        Row: {
          admin_note: string | null
          companions_count: number
          companions_names: string[] | null
          created_at: string
          display_name: string
          id: string
          meetup_event_id: string
          paid_amount_cents: number | null
          paid_at: string | null
          payment_status: string
          phone: string
          status: string
          stripe_session_id: string | null
          user_note: string | null
        }
        Insert: {
          admin_note?: string | null
          companions_count?: number
          companions_names?: string[] | null
          created_at?: string
          display_name: string
          id?: string
          meetup_event_id: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_status?: string
          phone: string
          status?: string
          stripe_session_id?: string | null
          user_note?: string | null
        }
        Update: {
          admin_note?: string | null
          companions_count?: number
          companions_names?: string[] | null
          created_at?: string
          display_name?: string
          id?: string
          meetup_event_id?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_status?: string
          phone?: string
          status?: string
          stripe_session_id?: string | null
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetup_registrations_meetup_event_id_fkey"
            columns: ["meetup_event_id"]
            isOneToOne: false
            referencedRelation: "meetup_events"
            referencedColumns: ["id"]
          },
        ]
      }
      monster_catalog: {
        Row: {
          created_at: string
          id: number
          image_url: string | null
          is_default_in_pool: boolean
          name: string
          pv_max_default: number
          reward_default: number
          type: string | null
        }
        Insert: {
          created_at?: string
          id: number
          image_url?: string | null
          is_default_in_pool?: boolean
          name: string
          pv_max_default?: number
          reward_default?: number
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string | null
          is_default_in_pool?: boolean
          name?: string
          pv_max_default?: number
          reward_default?: number
          type?: string | null
        }
        Relationships: []
      }
      monsters: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          monstre_id: number
          pv_actuels: number
          pv_max: number
          recompense: number | null
          session_game_id: string | null
          statut: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          monstre_id: number
          pv_actuels?: number
          pv_max?: number
          recompense?: number | null
          session_game_id?: string | null
          statut?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          monstre_id?: number
          pv_actuels?: number
          pv_max?: number
          recompense?: number | null
          session_game_id?: string | null
          statut?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_monsters_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monsters_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_effects: {
        Row: {
          by_num: number | null
          created_at: string | null
          game_id: string
          id: string
          manche: number
          session_game_id: string | null
          slot: number | null
          type: string
          weapon: string | null
        }
        Insert: {
          by_num?: number | null
          created_at?: string | null
          game_id: string
          id?: string
          manche: number
          session_game_id?: string | null
          slot?: number | null
          type: string
          weapon?: string | null
        }
        Update: {
          by_num?: number | null
          created_at?: string | null
          game_id?: string
          id?: string
          manche?: number
          session_game_id?: string | null
          slot?: number | null
          type?: string
          weapon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pending_effects_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_effects_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      positions_finales: {
        Row: {
          attaque1: string | null
          attaque2: string | null
          clan: string | null
          created_at: string | null
          game_id: string
          id: string
          manche: number
          mise: number | null
          nom: string | null
          num_joueur: number
          position_finale: number | null
          position_souhaitee: number | null
          protection: string | null
          rang_priorite: number | null
          session_game_id: string | null
          slot_attaque: number | null
          slot_protection: number | null
        }
        Insert: {
          attaque1?: string | null
          attaque2?: string | null
          clan?: string | null
          created_at?: string | null
          game_id: string
          id?: string
          manche: number
          mise?: number | null
          nom?: string | null
          num_joueur: number
          position_finale?: number | null
          position_souhaitee?: number | null
          protection?: string | null
          rang_priorite?: number | null
          session_game_id?: string | null
          slot_attaque?: number | null
          slot_protection?: number | null
        }
        Update: {
          attaque1?: string | null
          attaque2?: string | null
          clan?: string | null
          created_at?: string | null
          game_id?: string
          id?: string
          manche?: number
          mise?: number | null
          nom?: string | null
          num_joueur?: number
          position_finale?: number | null
          position_souhaitee?: number | null
          protection?: string | null
          rang_priorite?: number | null
          session_game_id?: string | null
          slot_attaque?: number | null
          slot_protection?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_positions_finales_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_finales_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_rankings: {
        Row: {
          created_at: string | null
          display_name: string | null
          game_id: string
          id: string
          manche: number
          mise_effective: number | null
          num_joueur: number
          player_id: string
          rank: number
          session_game_id: string | null
          tie_group_id: number | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          game_id: string
          id?: string
          manche: number
          mise_effective?: number | null
          num_joueur: number
          player_id: string
          rank: number
          session_game_id?: string | null
          tie_group_id?: number | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          game_id?: string
          id?: string
          manche?: number
          mise_effective?: number | null
          num_joueur?: number
          player_id?: string
          rank?: number
          session_game_id?: string | null
          tie_group_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_priority_rankings_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_rankings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          first_name: string
          games_played: number
          games_won: number
          id: string
          last_display_name_change: string | null
          last_name: string
          phone: string | null
          total_kills: number
          total_rewards: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          first_name: string
          games_played?: number
          games_won?: number
          id?: string
          last_display_name_change?: string | null
          last_name: string
          phone?: string | null
          total_kills?: number
          total_rewards?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          first_name?: string
          games_played?: number
          games_won?: number
          id?: string
          last_display_name_change?: string | null
          last_name?: string
          phone?: string | null
          total_kills?: number
          total_rewards?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      river_decisions: {
        Row: {
          decision: string
          game_id: string
          id: string
          keryndes_choice: string
          locked_at: string | null
          manche: number
          mise_demandee: number
          mise_effective: number | null
          niveau: number
          player_id: string
          player_num: number
          session_game_id: string
          status: string
          submitted_at: string
        }
        Insert: {
          decision: string
          game_id: string
          id?: string
          keryndes_choice?: string
          locked_at?: string | null
          manche: number
          mise_demandee?: number
          mise_effective?: number | null
          niveau: number
          player_id: string
          player_num: number
          session_game_id: string
          status?: string
          submitted_at?: string
        }
        Update: {
          decision?: string
          game_id?: string
          id?: string
          keryndes_choice?: string
          locked_at?: string | null
          manche?: number
          mise_demandee?: number
          mise_effective?: number | null
          niveau?: number
          player_id?: string
          player_num?: number
          session_game_id?: string
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "river_decisions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "river_decisions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "river_decisions_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      river_level_history: {
        Row: {
          cagnotte_after: number
          cagnotte_before: number
          danger_effectif: number | null
          danger_raw: number | null
          dice_count: number | null
          distribution_details: Json | null
          game_id: string
          id: string
          manche: number
          mj_summary: string | null
          niveau: number
          outcome: string
          public_summary: string | null
          resolved_at: string
          session_game_id: string
          total_mises: number
        }
        Insert: {
          cagnotte_after?: number
          cagnotte_before?: number
          danger_effectif?: number | null
          danger_raw?: number | null
          dice_count?: number | null
          distribution_details?: Json | null
          game_id: string
          id?: string
          manche: number
          mj_summary?: string | null
          niveau: number
          outcome: string
          public_summary?: string | null
          resolved_at?: string
          session_game_id: string
          total_mises?: number
        }
        Update: {
          cagnotte_after?: number
          cagnotte_before?: number
          danger_effectif?: number | null
          danger_raw?: number | null
          dice_count?: number | null
          distribution_details?: Json | null
          game_id?: string
          id?: string
          manche?: number
          mj_summary?: string | null
          niveau?: number
          outcome?: string
          public_summary?: string | null
          resolved_at?: string
          session_game_id?: string
          total_mises?: number
        }
        Relationships: [
          {
            foreignKeyName: "river_level_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "river_level_history_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      river_player_stats: {
        Row: {
          created_at: string
          current_round_status: string
          descended_level: number | null
          game_id: string
          id: string
          keryndes_available: boolean
          player_id: string
          player_num: number
          session_game_id: string
          updated_at: string
          validated_levels: number
        }
        Insert: {
          created_at?: string
          current_round_status?: string
          descended_level?: number | null
          game_id: string
          id?: string
          keryndes_available?: boolean
          player_id: string
          player_num: number
          session_game_id: string
          updated_at?: string
          validated_levels?: number
        }
        Update: {
          created_at?: string
          current_round_status?: string
          descended_level?: number | null
          game_id?: string
          id?: string
          keryndes_available?: boolean
          player_id?: string
          player_num?: number
          session_game_id?: string
          updated_at?: string
          validated_levels?: number
        }
        Relationships: [
          {
            foreignKeyName: "river_player_stats_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "river_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "river_player_stats_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      river_session_state: {
        Row: {
          cagnotte_manche: number
          created_at: string
          danger_dice_count: number | null
          danger_effectif: number | null
          danger_raw: number | null
          game_id: string
          id: string
          manche_active: number
          niveau_active: number
          session_game_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cagnotte_manche?: number
          created_at?: string
          danger_dice_count?: number | null
          danger_effectif?: number | null
          danger_raw?: number | null
          game_id: string
          id?: string
          manche_active?: number
          niveau_active?: number
          session_game_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cagnotte_manche?: number
          created_at?: string
          danger_dice_count?: number | null
          danger_effectif?: number | null
          danger_raw?: number | null
          game_id?: string
          id?: string
          manche_active?: number
          niveau_active?: number
          session_game_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "river_session_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "river_session_state_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: true
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      round_bets: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          manche: number
          mise: number
          mise_demandee: number | null
          mise_effective: number | null
          note: string | null
          num_joueur: number
          session_game_id: string | null
          status: string | null
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          manche: number
          mise?: number
          mise_demandee?: number | null
          mise_effective?: number | null
          note?: string | null
          num_joueur: number
          session_game_id?: string | null
          status?: string | null
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          manche?: number
          mise?: number
          mise_demandee?: number | null
          mise_effective?: number | null
          note?: string | null
          num_joueur?: number
          session_game_id?: string | null
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_round_bets_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_bets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      session_bans: {
        Row: {
          created_at: string
          created_by: string | null
          device_id: string
          game_id: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_id: string
          game_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_id?: string
          game_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_bans_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          audience: string
          created_at: string
          game_id: string
          id: string
          message: string
          payload: Json | null
          type: string
        }
        Insert: {
          audience?: string
          created_at?: string
          game_id: string
          id?: string
          message: string
          payload?: Json | null
          type?: string
        }
        Update: {
          audience?: string
          created_at?: string
          game_id?: string
          id?: string
          message?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      session_games: {
        Row: {
          config: Json | null
          created_at: string
          ended_at: string | null
          game_type_code: string
          id: string
          manche_active: number
          phase: string | null
          session_id: string
          started_at: string | null
          status: string
          step_index: number
        }
        Insert: {
          config?: Json | null
          created_at?: string
          ended_at?: string | null
          game_type_code: string
          id?: string
          manche_active?: number
          phase?: string | null
          session_id: string
          started_at?: string | null
          status?: string
          step_index: number
        }
        Update: {
          config?: Json | null
          created_at?: string
          ended_at?: string | null
          game_type_code?: string
          id?: string
          manche_active?: number
          phase?: string | null
          session_id?: string
          started_at?: string | null
          status?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_games_game_type_code_fkey"
            columns: ["game_type_code"]
            isOneToOne: false
            referencedRelation: "game_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "session_games_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      sheriff_duels: {
        Row: {
          created_at: string | null
          duel_order: number
          game_id: string
          id: string
          player1_number: number
          player1_searches: boolean | null
          player1_tokens_lost: number | null
          player1_vp_delta: number | null
          player2_number: number
          player2_searches: boolean | null
          player2_tokens_lost: number | null
          player2_vp_delta: number | null
          resolution_summary: Json | null
          resolved_at: string | null
          session_game_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          duel_order: number
          game_id: string
          id?: string
          player1_number: number
          player1_searches?: boolean | null
          player1_tokens_lost?: number | null
          player1_vp_delta?: number | null
          player2_number: number
          player2_searches?: boolean | null
          player2_tokens_lost?: number | null
          player2_vp_delta?: number | null
          resolution_summary?: Json | null
          resolved_at?: string | null
          session_game_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          duel_order?: number
          game_id?: string
          id?: string
          player1_number?: number
          player1_searches?: boolean | null
          player1_tokens_lost?: number | null
          player1_vp_delta?: number | null
          player2_number?: number
          player2_searches?: boolean | null
          player2_tokens_lost?: number | null
          player2_vp_delta?: number | null
          resolution_summary?: Json | null
          resolved_at?: string | null
          session_game_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheriff_duels_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheriff_duels_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      sheriff_player_choices: {
        Row: {
          created_at: string | null
          final_tokens: number | null
          game_id: string
          has_illegal_tokens: boolean | null
          id: string
          player_id: string
          player_number: number
          session_game_id: string | null
          tokens_entering: number | null
          updated_at: string | null
          victory_points_delta: number | null
          visa_choice: string | null
          visa_cost_applied: number | null
        }
        Insert: {
          created_at?: string | null
          final_tokens?: number | null
          game_id: string
          has_illegal_tokens?: boolean | null
          id?: string
          player_id: string
          player_number: number
          session_game_id?: string | null
          tokens_entering?: number | null
          updated_at?: string | null
          victory_points_delta?: number | null
          visa_choice?: string | null
          visa_cost_applied?: number | null
        }
        Update: {
          created_at?: string | null
          final_tokens?: number | null
          game_id?: string
          has_illegal_tokens?: boolean | null
          id?: string
          player_id?: string
          player_number?: number
          session_game_id?: string | null
          tokens_entering?: number | null
          updated_at?: string | null
          victory_points_delta?: number | null
          visa_choice?: string | null
          visa_cost_applied?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sheriff_player_choices_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheriff_player_choices_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheriff_player_choices_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      sheriff_round_state: {
        Row: {
          common_pool_initial: number | null
          common_pool_spent: number | null
          created_at: string | null
          current_duel_order: number | null
          game_id: string
          id: string
          phase: string | null
          session_game_id: string
          total_duels: number | null
          updated_at: string | null
        }
        Insert: {
          common_pool_initial?: number | null
          common_pool_spent?: number | null
          created_at?: string | null
          current_duel_order?: number | null
          game_id: string
          id?: string
          phase?: string | null
          session_game_id: string
          total_duels?: number | null
          updated_at?: string | null
        }
        Update: {
          common_pool_initial?: number | null
          common_pool_spent?: number | null
          created_at?: string | null
          current_duel_order?: number | null
          game_id?: string
          id?: string
          phase?: string | null
          session_game_id?: string
          total_duels?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheriff_round_state_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheriff_round_state_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: true
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_catalogue: {
        Row: {
          actif: boolean | null
          categorie: string
          cout_akila: number
          cout_normal: number
          created_at: string | null
          game_id: string | null
          id: string
          is_sniper_akila: boolean | null
          objet: string
          restock_apres_achat: boolean | null
        }
        Insert: {
          actif?: boolean | null
          categorie: string
          cout_akila?: number
          cout_normal?: number
          created_at?: string | null
          game_id?: string | null
          id?: string
          is_sniper_akila?: boolean | null
          objet: string
          restock_apres_achat?: boolean | null
        }
        Update: {
          actif?: boolean | null
          categorie?: string
          cout_akila?: number
          cout_normal?: number
          created_at?: string | null
          game_id?: string | null
          id?: string
          is_sniper_akila?: boolean | null
          objet?: string
          restock_apres_achat?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_catalogue_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_prices: {
        Row: {
          cost_akila: number
          cost_normal: number
          created_at: string
          id: string
          item_name: string
        }
        Insert: {
          cost_akila?: number
          cost_normal?: number
          created_at?: string
          id?: string
          item_name: string
        }
        Update: {
          cost_akila?: number
          cost_normal?: number
          created_at?: string
          id?: string
          item_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_prices_item_name_fkey"
            columns: ["item_name"]
            isOneToOne: true
            referencedRelation: "item_catalog"
            referencedColumns: ["name"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string | null
          colors: string[] | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price_eur: number
          sizes: string[] | null
          sort_order: number | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          colors?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price_eur?: number
          sizes?: string[] | null
          sort_order?: number | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          colors?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price_eur?: number
          sizes?: string[] | null
          sort_order?: number | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_requests: {
        Row: {
          created_at: string
          game_id: string
          id: string
          item_name: string | null
          manche: number
          player_id: string
          player_num: number
          session_game_id: string | null
          updated_at: string
          want_buy: boolean
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          item_name?: string | null
          manche: number
          player_id: string
          player_num: number
          session_game_id?: string | null
          updated_at?: string
          want_buy?: boolean
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          item_name?: string | null
          manche?: number
          player_id?: string
          player_num?: number
          session_game_id?: string | null
          updated_at?: string
          want_buy?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_shop_requests_session_game"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_scores: {
        Row: {
          created_at: string
          details: Json | null
          game_player_id: string
          id: string
          score_value: number
          session_game_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          game_player_id: string
          id?: string
          score_value?: number
          session_game_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          game_player_id?: string
          id?: string
          score_value?: number
          session_game_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_scores_game_player_id_fkey"
            columns: ["game_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_scores_session_game_id_fkey"
            columns: ["session_game_id"]
            isOneToOne: false
            referencedRelation: "session_games"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          created_at: string
          game_id: string
          id: string
          mate_group: number
          message: string
          sender_name: string
          sender_num: number
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          mate_group: number
          message: string
          sender_name: string
          sender_num: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          mate_group?: number
          message?: string
          sender_name?: string
          sender_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
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
      user_subscription_bonuses: {
        Row: {
          created_at: string
          id: string
          token_balance: number
          tokens_used_for_clan: number | null
          tokens_used_for_init: number | null
          trial_end_at: string
          trial_start_at: string
          trial_tier: string
          updated_at: string
          usage_reset_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token_balance?: number
          tokens_used_for_clan?: number | null
          tokens_used_for_init?: number | null
          trial_end_at: string
          trial_start_at?: string
          trial_tier?: string
          updated_at?: string
          usage_reset_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token_balance?: number
          tokens_used_for_clan?: number | null
          tokens_used_for_init?: number | null
          trial_end_at?: string
          trial_start_at?: string
          trial_tier?: string
          updated_at?: string
          usage_reset_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_loyalty_points: {
        Args: {
          p_amount: number
          p_granted_by?: string
          p_note?: string
          p_source: string
          p_transaction_type: string
          p_user_id: string
        }
        Returns: number
      }
      admin_search_user_by_email: {
        Args: { search_email: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      assign_admin_role: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      assign_super_admin_role: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      can_change_display_name: { Args: { p_user_id: string }; Returns: boolean }
      generate_unique_display_name: {
        Args: { p_display_name: string; p_user_id?: string }
        Returns: string
      }
      get_event_confirmed_count: {
        Args: { p_event_id: string }
        Returns: number
      }
      get_event_registration_count: {
        Args: { p_event_id: string }
        Returns: number
      }
      get_friend_comparison: {
        Args: { p_friend_user_id: string }
        Returns: {
          friend_games_played: number
          friend_games_won: number
          friend_wins_together: number
          games_together: number
          my_games_played: number
          my_games_won: number
          my_wins_together: number
        }[]
      }
      get_friend_limited_profile: {
        Args: { p_friend_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_game_players_for_participant: {
        Args: { p_game_id: string }
        Returns: {
          clan: string
          display_name: string
          is_alive: boolean
          is_bot: boolean
          jetons: number
          mate_num: number
          player_number: number
          recompenses: number
        }[]
      }
      get_games_together: {
        Args: { p_friend_user_id: string; p_limit?: number }
        Returns: {
          friend_display_name: string
          friend_result: string
          game_id: string
          game_name: string
          game_type_code: string
          my_display_name: string
          my_result: string
          played_at: string
        }[]
      }
      get_public_comparison: {
        Args: { p_target_user_id: string }
        Returns: {
          games_together: number
          my_games_played: number
          my_games_won: number
          my_wins_together: number
          target_games_played: number
          target_games_won: number
          target_wins_together: number
        }[]
      }
      get_public_game_history: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          game_id: string
          game_name: string
          game_type_code: string
          game_type_name: string
          played_at: string
          player_display_name: string
          result: string
        }[]
      }
      get_public_game_players: {
        Args: { p_game_id: string }
        Returns: {
          clan: string
          display_name: string
          is_alive: boolean
          is_bot: boolean
          player_number: number
        }[]
      }
      get_public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          games_played: number
          games_won: number
          total_rewards: number
          user_id: string
        }[]
      }
      get_user_email: { Args: { user_id: string }; Returns: string }
      get_user_game_history: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          ended_at: string
          game_id: string
          game_name: string
          game_type_code: string
          game_type_name: string
          mode: string
          my_jetons: number
          my_kills: number
          my_recompenses: number
          my_result: string
          my_team_mate: string
          played_at: string
          player_count: number
          total_count: number
          was_host: boolean
        }[]
      }
      get_user_game_stats: {
        Args: { p_user_id: string }
        Returns: {
          games_created: number
          games_played: number
          games_won: number
        }[]
      }
      get_user_loyalty_info: {
        Args: { p_user_id: string }
        Returns: {
          balance: number
          total_earned: number
          total_spent: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_game_monsters: {
        Args: { p_game_id: string }
        Returns: undefined
      }
      initialize_game_state_monsters:
        | { Args: { p_game_id: string }; Returns: undefined }
        | {
            Args: { p_game_id: string; p_session_game_id?: string }
            Returns: undefined
          }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      public_game_feed: {
        Args: { p_game_id: string }
        Returns: {
          entry_id: string
          event_timestamp: string
          manche: number
          message: string
          phase_label: string
          source_type: string
        }[]
      }
      public_game_info: {
        Args: { p_game_id: string }
        Returns: {
          current_session_game_id: string
          current_step_index: number
          game_id: string
          game_type_code: string
          game_type_name: string
          is_ended: boolean
          manche_active: number
          mode: string
          name: string
          phase: string
          player_count: number
          status: string
        }[]
      }
      public_game_participants: {
        Args: { p_game_id: string }
        Returns: {
          clan: string
          display_name: string
          is_alive: boolean
          player_number: number
        }[]
      }
      public_list_live_games: {
        Args: never
        Returns: {
          current_session_game_id: string
          current_step_index: number
          game_id: string
          game_type_name: string
          manche_active: number
          mode: string
          name: string
          phase: string
          player_count: number
          selected_game_type_code: string
          status: string
          updated_at: string
        }[]
      }
      replace_num_by_name: {
        Args: { p_game_id: string; p_message: string }
        Returns: string
      }
      search_users_for_friendship: {
        Args: { p_limit?: number; p_search_term: string }
        Returns: {
          avatar_url: string
          display_name: string
          friendship_id: string
          friendship_status: string
          is_requester: boolean
          user_id: string
        }[]
      }
      update_player_stats_on_game_end: {
        Args: { p_game_id: string; p_winner_user_id?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      budget_scenario: "pessimiste" | "probable" | "optimiste"
      game_type_status: "PROJECT" | "COMING_SOON" | "AVAILABLE"
      invite_status:
        | "paid"
        | "confirmed_unpaid"
        | "pending"
        | "free"
        | "declined"
        | "not_invited_yet"
        | "not_invited"
      item_category: "ATTAQUE" | "PROTECTION" | "UTILITAIRE"
      monster_initial_status: "EN_BATAILLE" | "EN_FILE"
      monster_runtime_status: "EN_BATAILLE" | "EN_FILE" | "MORT"
      task_status: "not_started" | "in_progress" | "completed" | "blocked"
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
      app_role: ["super_admin", "admin", "user"],
      budget_scenario: ["pessimiste", "probable", "optimiste"],
      game_type_status: ["PROJECT", "COMING_SOON", "AVAILABLE"],
      invite_status: [
        "paid",
        "confirmed_unpaid",
        "pending",
        "free",
        "declined",
        "not_invited_yet",
        "not_invited",
      ],
      item_category: ["ATTAQUE", "PROTECTION", "UTILITAIRE"],
      monster_initial_status: ["EN_BATAILLE", "EN_FILE"],
      monster_runtime_status: ["EN_BATAILLE", "EN_FILE", "MORT"],
      task_status: ["not_started", "in_progress", "completed", "blocked"],
    },
  },
} as const
