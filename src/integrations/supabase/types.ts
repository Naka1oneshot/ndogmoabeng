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
        ]
      }
      battlefield: {
        Row: {
          created_at: string | null
          game_id: string
          id: string
          monstre_id_en_place: number | null
          pv_miroir: number | null
          slot: number
        }
        Insert: {
          created_at?: string | null
          game_id: string
          id?: string
          monstre_id_en_place?: number | null
          pv_miroir?: number | null
          slot: number
        }
        Update: {
          created_at?: string | null
          game_id?: string
          id?: string
          monstre_id_en_place?: number | null
          pv_miroir?: number | null
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
        }
        Relationships: [
          {
            foreignKeyName: "combat_results_game_id_fkey"
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
        }
        Relationships: [
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
        }
        Relationships: [
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
          device_id: string | null
          display_name: string
          game_id: string
          id: string
          is_alive: boolean | null
          is_host: boolean
          jetons: number | null
          joined_at: string
          last_seen: string | null
          mate_num: number | null
          player_number: number | null
          player_token: string | null
          recompenses: number | null
          removed_at: string | null
          removed_by: string | null
          removed_reason: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          clan?: string | null
          device_id?: string | null
          display_name: string
          game_id: string
          id?: string
          is_alive?: boolean | null
          is_host?: boolean
          jetons?: number | null
          joined_at?: string
          last_seen?: string | null
          mate_num?: number | null
          player_number?: number | null
          player_token?: string | null
          recompenses?: number | null
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          clan?: string | null
          device_id?: string | null
          display_name?: string
          game_id?: string
          id?: string
          is_alive?: boolean | null
          is_host?: boolean
          jetons?: number | null
          joined_at?: string
          last_seen?: string | null
          mate_num?: number | null
          player_number?: number | null
          player_token?: string | null
          recompenses?: number | null
          removed_at?: string | null
          removed_by?: string | null
          removed_reason?: string | null
          status?: string | null
          user_id?: string | null
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
        }
        Insert: {
          created_at?: string
          game_id: string
          generated_at?: string
          id?: string
          item_ids?: string[]
          locked?: boolean
          manche: number
        }
        Update: {
          created_at?: string
          game_id?: string
          generated_at?: string
          id?: string
          item_ids?: string[]
          locked?: boolean
          manche?: number
        }
        Relationships: [
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
          status?: Database["public"]["Enums"]["monster_runtime_status"]
          updated_at?: string
        }
        Relationships: [
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
      games: {
        Row: {
          created_at: string
          host_user_id: string
          id: string
          join_code: string
          manche_active: number | null
          name: string
          phase: string
          phase_locked: boolean
          sens_depart_egalite: string | null
          starting_tokens: number
          status: string
          x_nb_joueurs: number | null
        }
        Insert: {
          created_at?: string
          host_user_id: string
          id?: string
          join_code: string
          manche_active?: number | null
          name?: string
          phase?: string
          phase_locked?: boolean
          sens_depart_egalite?: string | null
          starting_tokens?: number
          status?: string
          x_nb_joueurs?: number | null
        }
        Update: {
          created_at?: string
          host_user_id?: string
          id?: string
          join_code?: string
          manche_active?: number | null
          name?: string
          phase?: string
          phase_locked?: boolean
          sens_depart_egalite?: string | null
          starting_tokens?: number
          status?: string
          x_nb_joueurs?: number | null
        }
        Relationships: []
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
        }
        Relationships: [
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
      logs_joueurs: {
        Row: {
          game_id: string
          id: string
          log_index: number
          manche: number | null
          message: string | null
          timestamp: string | null
          type: string | null
        }
        Insert: {
          game_id: string
          id?: string
          log_index?: number
          manche?: number | null
          message?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Update: {
          game_id?: string
          id?: string
          log_index?: number
          manche?: number | null
          message?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Relationships: [
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
          timestamp: string | null
        }
        Insert: {
          action: string
          details?: string | null
          game_id: string
          id?: string
          manche?: number | null
          num_joueur?: number | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          details?: string | null
          game_id?: string
          id?: string
          manche?: number | null
          num_joueur?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_mj_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      monster_catalog: {
        Row: {
          created_at: string
          id: number
          is_default_in_pool: boolean
          name: string
          pv_max_default: number
          reward_default: number
        }
        Insert: {
          created_at?: string
          id: number
          is_default_in_pool?: boolean
          name: string
          pv_max_default?: number
          reward_default?: number
        }
        Update: {
          created_at?: string
          id?: number
          is_default_in_pool?: boolean
          name?: string
          pv_max_default?: number
          reward_default?: number
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
          statut?: string | null
          type?: string
        }
        Relationships: [
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
          slot?: number | null
          type?: string
          weapon?: string | null
        }
        Relationships: [
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
          slot_attaque?: number | null
          slot_protection?: number | null
        }
        Relationships: [
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
          tie_group_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "priority_rankings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
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
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: [
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
      assign_admin_role: {
        Args: { target_user_id: string }
        Returns: undefined
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
      initialize_game_state_monsters: {
        Args: { p_game_id: string }
        Returns: undefined
      }
      replace_num_by_name: {
        Args: { p_game_id: string; p_message: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      item_category: "ATTAQUE" | "PROTECTION" | "UTILITAIRE"
      monster_initial_status: "EN_BATAILLE" | "EN_FILE"
      monster_runtime_status: "EN_BATAILLE" | "EN_FILE" | "MORT"
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
      app_role: ["admin", "user"],
      item_category: ["ATTAQUE", "PROTECTION", "UTILITAIRE"],
      monster_initial_status: ["EN_BATAILLE", "EN_FILE"],
      monster_runtime_status: ["EN_BATAILLE", "EN_FILE", "MORT"],
    },
  },
} as const
