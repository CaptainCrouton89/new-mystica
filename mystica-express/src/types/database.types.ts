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
    PostgrestVersion: "13.0.5"
  }
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
      analyticsevents: {
        Row: {
          event_name: string
          id: string
          properties: Json | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          event_name: string
          id?: string
          properties?: Json | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: string
          properties?: Json | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_analytics_events_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_analytics_events_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_analytics_events_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      combatchatterlog: {
        Row: {
          combat_context: Json | null
          event_type: string
          generated_dialogue: string | null
          generation_time_ms: number | null
          id: string
          personality_type: string | null
          pet_item_id: string
          session_id: string
          timestamp: string
          was_ai_generated: boolean | null
        }
        Insert: {
          combat_context?: Json | null
          event_type: string
          generated_dialogue?: string | null
          generation_time_ms?: number | null
          id?: string
          personality_type?: string | null
          pet_item_id: string
          session_id: string
          timestamp?: string
          was_ai_generated?: boolean | null
        }
        Update: {
          combat_context?: Json | null
          event_type?: string
          generated_dialogue?: string | null
          generation_time_ms?: number | null
          id?: string
          personality_type?: string | null
          pet_item_id?: string
          session_id?: string
          timestamp?: string
          was_ai_generated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_combat_chatter_log_pet"
            columns: ["pet_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_chatter_log_pet"
            columns: ["pet_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_chatter_log_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "combatsessions"
            referencedColumns: ["id"]
          },
        ]
      }
      combatlogevents: {
        Row: {
          actor: Database["public"]["Enums"]["actor"]
          combat_id: string
          event_type: string
          id: string | null
          payload: Json | null
          seq: number
          ts: string
          value_i: number | null
        }
        Insert: {
          actor: Database["public"]["Enums"]["actor"]
          combat_id: string
          event_type: string
          id?: string | null
          payload?: Json | null
          seq: number
          ts?: string
          value_i?: number | null
        }
        Update: {
          actor?: Database["public"]["Enums"]["actor"]
          combat_id?: string
          event_type?: string
          id?: string | null
          payload?: Json | null
          seq?: number
          ts?: string
          value_i?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_combat_log_events_combat"
            columns: ["combat_id"]
            isOneToOne: false
            referencedRelation: "combatsessions"
            referencedColumns: ["id"]
          },
        ]
      }
      combatsessions: {
        Row: {
          applied_enemy_pools: Json | null
          combat_level: number
          combat_log: Json | null
          created_at: string
          enemy_rating: number | null
          enemy_type_id: string
          id: string
          location_id: string
          outcome: Database["public"]["Enums"]["combat_result"] | null
          player_equipped_items_snapshot: Json | null
          player_rating: number | null
          rewards: Json | null
          updated_at: string
          user_id: string
          win_prob_est: number | null
        }
        Insert: {
          applied_enemy_pools?: Json | null
          combat_level: number
          combat_log?: Json | null
          created_at?: string
          enemy_rating?: number | null
          enemy_type_id: string
          id?: string
          location_id: string
          outcome?: Database["public"]["Enums"]["combat_result"] | null
          player_equipped_items_snapshot?: Json | null
          player_rating?: number | null
          rewards?: Json | null
          updated_at?: string
          user_id: string
          win_prob_est?: number | null
        }
        Update: {
          applied_enemy_pools?: Json | null
          combat_level?: number
          combat_log?: Json | null
          created_at?: string
          enemy_rating?: number | null
          enemy_type_id?: string
          id?: string
          location_id?: string
          outcome?: Database["public"]["Enums"]["combat_result"] | null
          player_equipped_items_snapshot?: Json | null
          player_rating?: number | null
          rewards?: Json | null
          updated_at?: string
          user_id?: string
          win_prob_est?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_combat_sessions_enemy_type"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "enemytypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_sessions_enemy_type"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "v_enemy_realized_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_sessions_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_sessions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_combat_sessions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_combat_sessions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_name: string
          icon_url: string | null
          is_premium: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_name: string
          icon_url?: string | null
          is_premium?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_name?: string
          icon_url?: string | null
          is_premium?: boolean
        }
        Relationships: []
      }
      devicetokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_device_tokens_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_device_tokens_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_device_tokens_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      economytransactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          currency: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_economy_transactions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_economy_transactions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_economy_transactions_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      enemychatterlog: {
        Row: {
          combat_context: Json | null
          dialogue_tone: string | null
          enemy_type_id: string
          event_type: string
          generated_dialogue: string | null
          generation_time_ms: number | null
          id: string
          player_metadata: Json | null
          session_id: string
          timestamp: string
          was_ai_generated: boolean | null
        }
        Insert: {
          combat_context?: Json | null
          dialogue_tone?: string | null
          enemy_type_id: string
          event_type: string
          generated_dialogue?: string | null
          generation_time_ms?: number | null
          id?: string
          player_metadata?: Json | null
          session_id: string
          timestamp?: string
          was_ai_generated?: boolean | null
        }
        Update: {
          combat_context?: Json | null
          dialogue_tone?: string | null
          enemy_type_id?: string
          event_type?: string
          generated_dialogue?: string | null
          generation_time_ms?: number | null
          id?: string
          player_metadata?: Json | null
          session_id?: string
          timestamp?: string
          was_ai_generated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_enemy_chatter_log_enemy_type"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "enemytypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_enemy_chatter_log_enemy_type"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "v_enemy_realized_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_enemy_chatter_log_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "combatsessions"
            referencedColumns: ["id"]
          },
        ]
      }
      enemyloot: {
        Row: {
          created_at: string | null
          drop_weight: number
          enemy_type_id: string
          guaranteed: boolean
          id: string
          lootable_id: string
          lootable_type: string
        }
        Insert: {
          created_at?: string | null
          drop_weight?: number
          enemy_type_id: string
          guaranteed?: boolean
          id?: string
          lootable_id: string
          lootable_type: string
        }
        Update: {
          created_at?: string | null
          drop_weight?: number
          enemy_type_id?: string
          guaranteed?: boolean
          id?: string
          lootable_id?: string
          lootable_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "enemyloot_enemy_type_id_fkey"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "enemytypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enemyloot_enemy_type_id_fkey"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "v_enemy_realized_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      enemypoolmembers: {
        Row: {
          created_at: string
          enemy_pool_id: string
          enemy_type_id: string
          id: string
          spawn_weight: number
        }
        Insert: {
          created_at?: string
          enemy_pool_id: string
          enemy_type_id: string
          id?: string
          spawn_weight?: number
        }
        Update: {
          created_at?: string
          enemy_pool_id?: string
          enemy_type_id?: string
          id?: string
          spawn_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_enemy_pool_members_enemy_type"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "enemytypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_enemy_pool_members_enemy_type"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "v_enemy_realized_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_enemy_pool_members_pool"
            columns: ["enemy_pool_id"]
            isOneToOne: false
            referencedRelation: "enemypools"
            referencedColumns: ["id"]
          },
        ]
      }
      enemypools: {
        Row: {
          combat_level: number
          created_at: string
          filter_type: string
          filter_value: string | null
          id: string
          name: string
        }
        Insert: {
          combat_level: number
          created_at?: string
          filter_type: string
          filter_value?: string | null
          id?: string
          name: string
        }
        Update: {
          combat_level?: number
          created_at?: string
          filter_type?: string
          filter_value?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      enemytypes: {
        Row: {
          ai_personality_traits: Json | null
          atk_accuracy_normalized: number
          atk_power_normalized: number
          base_hp: number
          def_accuracy_normalized: number
          def_power_normalized: number
          dialogue_guidelines: string | null
          dialogue_tone: string | null
          id: string
          name: string
          tier_id: number
        }
        Insert: {
          ai_personality_traits?: Json | null
          atk_accuracy_normalized?: number
          atk_power_normalized?: number
          base_hp?: number
          def_accuracy_normalized?: number
          def_power_normalized?: number
          dialogue_guidelines?: string | null
          dialogue_tone?: string | null
          id?: string
          name: string
          tier_id: number
        }
        Update: {
          ai_personality_traits?: Json | null
          atk_accuracy_normalized?: number
          atk_power_normalized?: number
          base_hp?: number
          def_accuracy_normalized?: number
          def_power_normalized?: number
          dialogue_guidelines?: string | null
          dialogue_tone?: string | null
          id?: string
          name?: string
          tier_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_enemy_types_tier"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      enemytypestyles: {
        Row: {
          created_at: string | null
          enemy_type_id: string
          id: string
          style_id: string
          weight_multiplier: number
        }
        Insert: {
          created_at?: string | null
          enemy_type_id: string
          id?: string
          style_id: string
          weight_multiplier?: number
        }
        Update: {
          created_at?: string | null
          enemy_type_id?: string
          id?: string
          style_id?: string
          weight_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "enemytypestyles_enemy_type_id_fkey"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "enemytypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enemytypestyles_enemy_type_id_fkey"
            columns: ["enemy_type_id"]
            isOneToOne: false
            referencedRelation: "v_enemy_realized_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enemytypestyles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styledefinitions"
            referencedColumns: ["id"]
          },
        ]
      }
      equipmentslots: {
        Row: {
          description: string | null
          display_name: string
          slot_name: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          display_name: string
          slot_name: string
          sort_order: number
        }
        Update: {
          description?: string | null
          display_name?: string
          slot_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      itemhistory: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_item_history_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_item_history_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_item_history_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_item_history_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_item_history_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      itemimagecache: {
        Row: {
          combo_hash: string
          craft_count: number
          created_at: string
          id: string
          image_url: string
          item_type_id: string
          provider: string | null
        }
        Insert: {
          combo_hash: string
          craft_count?: number
          created_at?: string
          id?: string
          image_url: string
          item_type_id: string
          provider?: string | null
        }
        Update: {
          combo_hash?: string
          craft_count?: number
          created_at?: string
          id?: string
          image_url?: string
          item_type_id?: string
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_item_image_cache_item_type"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "itemtypes"
            referencedColumns: ["id"]
          },
        ]
      }
      itemmaterials: {
        Row: {
          applied_at: string
          id: string
          item_id: string
          material_instance_id: string
          slot_index: number
        }
        Insert: {
          applied_at?: string
          id?: string
          item_id: string
          material_instance_id: string
          slot_index: number
        }
        Update: {
          applied_at?: string
          id?: string
          item_id?: string
          material_instance_id?: string
          slot_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_item_materials_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_item_materials_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_item_materials_material_instance"
            columns: ["material_instance_id"]
            isOneToOne: true
            referencedRelation: "materialinstances"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          created_at: string
          current_stats: Json | null
          description: string | null
          generated_image_url: string | null
          id: string
          image_generation_status: string | null
          is_styled: boolean
          item_type_id: string
          level: number
          material_combo_hash: string | null
          name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stats?: Json | null
          description?: string | null
          generated_image_url?: string | null
          id?: string
          image_generation_status?: string | null
          is_styled?: boolean
          item_type_id: string
          level?: number
          material_combo_hash?: string | null
          name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_stats?: Json | null
          description?: string | null
          generated_image_url?: string | null
          id?: string
          image_generation_status?: string | null
          is_styled?: boolean
          item_type_id?: string
          level?: number
          material_combo_hash?: string | null
          name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_items_item_type"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "itemtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_items_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_items_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_items_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      itemtypes: {
        Row: {
          base_image_url: string
          base_stats_normalized: Json
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
        }
        Insert: {
          base_image_url?: string
          base_stats_normalized: Json
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
        }
        Update: {
          base_image_url?: string
          base_stats_normalized?: Json
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rarity?: Database["public"]["Enums"]["rarity"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_item_types_rarity"
            columns: ["rarity"]
            isOneToOne: false
            referencedRelation: "raritydefinitions"
            referencedColumns: ["rarity"]
          },
        ]
      }
      levelrewards: {
        Row: {
          created_at: string
          is_claimable: boolean
          level: number
          reward_description: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number
        }
        Insert: {
          created_at?: string
          is_claimable?: boolean
          level: number
          reward_description: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number
        }
        Update: {
          created_at?: string
          is_claimable?: boolean
          level?: number
          reward_description?: string
          reward_type?: Database["public"]["Enums"]["reward_type"]
          reward_value?: number
        }
        Relationships: []
      }
      loadouts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_loadouts_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loadouts_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_loadouts_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      loadoutslots: {
        Row: {
          item_id: string | null
          loadout_id: string
          slot_name: string
        }
        Insert: {
          item_id?: string | null
          loadout_id: string
          slot_name: string
        }
        Update: {
          item_id?: string | null
          loadout_id?: string
          slot_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_loadout_slots_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loadout_slots_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loadout_slots_loadout"
            columns: ["loadout_id"]
            isOneToOne: false
            referencedRelation: "loadouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loadout_slots_slot"
            columns: ["slot_name"]
            isOneToOne: false
            referencedRelation: "equipmentslots"
            referencedColumns: ["slot_name"]
          },
        ]
      }
      locations: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          image_url: string | null
          lat: number
          lng: number
          location_type: string | null
          name: string | null
          state_code: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          lat: number
          lng: number
          location_type?: string | null
          name?: string | null
          state_code?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          lat?: number
          lng?: number
          location_type?: string | null
          name?: string | null
          state_code?: string | null
        }
        Relationships: []
      }
      materialinstances: {
        Row: {
          created_at: string
          id: string
          material_id: string
          style_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          style_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          style_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_material_instances_material"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_instances_material"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_tiers"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "fk_material_instances_style"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styledefinitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_instances_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_instances_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_material_instances_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      materials: {
        Row: {
          base_drop_weight: number
          created_at: string
          description: string | null
          id: string
          name: string
          stat_modifiers: Json
        }
        Insert: {
          base_drop_weight?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          stat_modifiers: Json
        }
        Update: {
          base_drop_weight?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          stat_modifiers?: Json
        }
        Relationships: []
      }
      materialstacks: {
        Row: {
          material_id: string
          quantity: number
          style_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          material_id: string
          quantity: number
          style_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          material_id?: string
          quantity?: number
          style_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_material_stacks_material"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_stacks_material"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_tiers"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "fk_material_stacks_style"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styledefinitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_stacks_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_material_stacks_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_material_stacks_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      materialstrengthtiers: {
        Row: {
          created_at: string
          display_name: string
          max_abs_sum: number
          min_abs_sum: number
          tier_name: string
        }
        Insert: {
          created_at?: string
          display_name: string
          max_abs_sum: number
          min_abs_sum: number
          tier_name: string
        }
        Update: {
          created_at?: string
          display_name?: string
          max_abs_sum?: number
          min_abs_sum?: number
          tier_name?: string
        }
        Relationships: []
      }
      petpersonalities: {
        Row: {
          base_dialogue_style: string | null
          description: string | null
          display_name: string
          example_phrases: Json | null
          id: string
          personality_type: string
          traits: Json | null
          verbosity: string | null
        }
        Insert: {
          base_dialogue_style?: string | null
          description?: string | null
          display_name: string
          example_phrases?: Json | null
          id?: string
          personality_type: string
          traits?: Json | null
          verbosity?: string | null
        }
        Update: {
          base_dialogue_style?: string | null
          description?: string | null
          display_name?: string
          example_phrases?: Json | null
          id?: string
          personality_type?: string
          traits?: Json | null
          verbosity?: string | null
        }
        Relationships: []
      }
      pets: {
        Row: {
          chatter_history: Json | null
          custom_name: string | null
          item_id: string
          personality_id: string | null
        }
        Insert: {
          chatter_history?: Json | null
          custom_name?: string | null
          item_id: string
          personality_id?: string | null
        }
        Update: {
          chatter_history?: Json | null
          custom_name?: string | null
          item_id?: string
          personality_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pets_item"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pets_item"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pets_personality"
            columns: ["personality_id"]
            isOneToOne: false
            referencedRelation: "petpersonalities"
            referencedColumns: ["id"]
          },
        ]
      }
      playercombathistory: {
        Row: {
          current_streak: number
          defeats: number
          last_attempt: string | null
          location_id: string
          longest_streak: number
          total_attempts: number
          user_id: string
          victories: number
        }
        Insert: {
          current_streak?: number
          defeats?: number
          last_attempt?: string | null
          location_id: string
          longest_streak?: number
          total_attempts?: number
          user_id: string
          victories?: number
        }
        Update: {
          current_streak?: number
          defeats?: number
          last_attempt?: string | null
          location_id?: string
          longest_streak?: number
          total_attempts?: number
          user_id?: string
          victories?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_combat_history_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_player_combat_history_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_player_combat_history_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_player_combat_history_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      playerprogression: {
        Row: {
          created_at: string
          last_level_up_at: string | null
          level: number
          updated_at: string
          user_id: string
          xp: number
          xp_to_next_level: number
        }
        Insert: {
          created_at?: string
          last_level_up_at?: string | null
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
          xp_to_next_level: number
        }
        Update: {
          created_at?: string
          last_level_up_at?: string | null
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
          xp_to_next_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_player_progression_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_player_progression_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_player_progression_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      raritydefinitions: {
        Row: {
          base_drop_rate: number
          color_hex: string | null
          created_at: string
          display_name: string
          rarity: Database["public"]["Enums"]["rarity"]
          stat_multiplier: number
        }
        Insert: {
          base_drop_rate: number
          color_hex?: string | null
          created_at?: string
          display_name: string
          rarity: Database["public"]["Enums"]["rarity"]
          stat_multiplier: number
        }
        Update: {
          base_drop_rate?: number
          color_hex?: string | null
          created_at?: string
          display_name?: string
          rarity?: Database["public"]["Enums"]["rarity"]
          stat_multiplier?: number
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      styledefinitions: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          spawn_rate: number
          style_name: string
          visual_modifier: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          spawn_rate: number
          style_name: string
          visual_modifier?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          spawn_rate?: number
          style_name?: string
          visual_modifier?: string | null
        }
        Relationships: []
      }
      tiers: {
        Row: {
          created_at: string
          description: string | null
          difficulty_multiplier: number
          display_name: string
          gold_multiplier: number
          id: number
          tier_num: number
          xp_multiplier: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty_multiplier?: number
          display_name: string
          gold_multiplier?: number
          id?: number
          tier_num: number
          xp_multiplier?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty_multiplier?: number
          display_name?: string
          gold_multiplier?: number
          id?: number
          tier_num?: number
          xp_multiplier?: number
        }
        Relationships: []
      }
      usercurrencybalances: {
        Row: {
          balance: number
          currency_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          currency_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          currency_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_currency_balances_currency"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_user_currency_balances_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_currency_balances_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_user_currency_balances_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      userequipment: {
        Row: {
          equipped_at: string | null
          item_id: string | null
          slot_name: string
          user_id: string
        }
        Insert: {
          equipped_at?: string | null
          item_id?: string | null
          slot_name: string
          user_id: string
        }
        Update: {
          equipped_at?: string | null
          item_id?: string | null
          slot_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_equipment_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_equipment_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_equipment_slot"
            columns: ["slot_name"]
            isOneToOne: false
            referencedRelation: "equipmentslots"
            referencedColumns: ["slot_name"]
          },
          {
            foreignKeyName: "fk_user_equipment_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_equipment_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_user_equipment_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      userlevelrewards: {
        Row: {
          claimed_at: string
          level: number
          reward_amount: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          level: number
          reward_amount: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          level?: number
          reward_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "userlevelrewards_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "levelrewards"
            referencedColumns: ["level"]
          },
          {
            foreignKeyName: "userlevelrewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "userlevelrewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "userlevelrewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      users: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          avg_item_level: number | null
          created_at: string
          device_id: string | null
          email: string | null
          id: string
          is_anonymous: boolean | null
          last_login: string | null
          vanity_level: number
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avg_item_level?: number | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          id: string
          is_anonymous?: boolean | null
          last_login?: string | null
          vanity_level?: number
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avg_item_level?: number | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          id?: string
          is_anonymous?: boolean | null
          last_login?: string | null
          vanity_level?: number
        }
        Relationships: []
      }
      userunlockeditemtypes: {
        Row: {
          item_type_id: string
          unlock_source: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          item_type_id: string
          unlock_source: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          item_type_id?: string
          unlock_source?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_unlocked_item_types_item_type"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "itemtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_unlocked_item_types_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_unlocked_item_types_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_equipped_stats"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "fk_user_unlocked_item_types_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_player_powerlevel"
            referencedColumns: ["player_id"]
          },
        ]
      }
      weapons: {
        Row: {
          deg_crit: number
          deg_graze: number
          deg_injure: number
          deg_miss: number
          deg_normal: number
          item_id: string
          pattern: Database["public"]["Enums"]["weapon_pattern"]
          spin_deg_per_s: number
        }
        Insert: {
          deg_crit?: number
          deg_graze?: number
          deg_injure?: number
          deg_miss?: number
          deg_normal?: number
          item_id: string
          pattern: Database["public"]["Enums"]["weapon_pattern"]
          spin_deg_per_s?: number
        }
        Update: {
          deg_crit?: number
          deg_graze?: number
          deg_injure?: number
          deg_miss?: number
          deg_normal?: number
          item_id?: string
          pattern?: Database["public"]["Enums"]["weapon_pattern"]
          spin_deg_per_s?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_weapons_item"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_weapons_item"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_enemy_realized_stats: {
        Row: {
          atk_accuracy_normalized: number | null
          atk_power_normalized: number | null
          base_hp: number | null
          def_accuracy_normalized: number | null
          def_power_normalized: number | null
          difficulty_multiplier: number | null
          gold_multiplier: number | null
          id: string | null
          name: string | null
          realized_hp: number | null
          tier_display_name: string | null
          tier_id: number | null
          tier_num: number | null
          xp_multiplier: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_enemy_types_tier"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_total_stats: {
        Row: {
          atk_accuracy: number | null
          atk_power: number | null
          def_accuracy: number | null
          def_power: number | null
          id: string | null
          is_styled: boolean | null
          level: number | null
          name: string | null
          rarity: Database["public"]["Enums"]["rarity"] | null
          slot: string | null
          total_stats: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_item_types_rarity"
            columns: ["rarity"]
            isOneToOne: false
            referencedRelation: "raritydefinitions"
            referencedColumns: ["rarity"]
          },
        ]
      }
      v_material_tiers: {
        Row: {
          abs_sum: number | null
          material_id: string | null
          tier_name: string | null
        }
        Relationships: []
      }
      v_player_equipped_stats: {
        Row: {
          acc: number | null
          atk: number | null
          combat_rating: number | null
          def: number | null
          hp: number | null
          player_id: string | null
        }
        Relationships: []
      }
      v_player_powerlevel: {
        Row: {
          acc: number | null
          atk: number | null
          def: number | null
          expected_mul: number | null
          hp: number | null
          player_id: string | null
          power_level: number | null
          weapon_item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_equipment_item"
            columns: ["weapon_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_equipment_item"
            columns: ["weapon_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_total_stats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      activate_loadout: {
        Args: { p_loadout_id: string; p_user_id: string }
        Returns: Json
      }
      add_currency_with_logging: {
        Args: {
          p_amount: number
          p_currency_code: string
          p_metadata?: Json
          p_source_id: string
          p_source_type: string
          p_user_id: string
        }
        Returns: Json
      }
      add_xp_and_level_up: {
        Args: { p_user_id: string; p_xp_amount: number }
        Returns: Json
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      apply_material_to_item: {
        Args: {
          p_item_id: string
          p_material_id: string
          p_slot_index: number
          p_style_id: string
          p_user_id: string
        }
        Returns: Json
      }
      combat_rating: {
        Args: {
          alpha_atk?: number
          alpha_ehp?: number
          atk: number
          defense: number
          hp: number
        }
        Returns: number
      }
      deduct_currency_with_logging: {
        Args: {
          p_amount: number
          p_currency_code: string
          p_metadata?: Json
          p_source_id: string
          p_source_type: string
          p_user_id: string
        }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      effective_hp: {
        Args: { def_k?: number; defense: number; hp: number }
        Returns: number
      }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      equip_item: {
        Args: { p_item_id: string; p_slot_name: string; p_user_id: string }
        Returns: Json
      }
      exec: { Args: { sql: string }; Returns: Json }
      fn_acc_scale: {
        Args: { acc: number; k_acc?: number; s_max?: number }
        Returns: number
      }
      fn_add_pet_chatter_message: {
        Args: {
          p_item_id: string
          p_max_messages?: number
          p_message_text: string
          p_message_type?: string
        }
        Returns: Json
      }
      fn_expected_mul_quick: {
        Args: {
          mul_crit?: number
          mul_graze?: number
          mul_injure?: number
          mul_miss?: number
          mul_normal?: number
          player_acc: number
          w_id: string
        }
        Returns: number
      }
      fn_weapon_bands_adjusted: {
        Args: { player_acc: number; w_id: string }
        Returns: {
          deg_crit: number
          deg_graze: number
          deg_injure: number
          deg_miss: number
          deg_normal: number
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_nearby_locations: {
        Args: { search_radius: number; user_lat: number; user_lng: number }
        Returns: {
          country_code: string
          distance_meters: number
          id: string
          image_url: string
          lat: number
          lng: number
          location_type: string
          name: string
          state_code: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increment_craft_count: { Args: { cache_id: string }; Returns: number }
      init_profile: {
        Args: { p_email: string; p_user_id: string }
        Returns: {
          avg_item_level: number
          created_at: string
          email: string
          id: string
          vanity_level: number
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      process_item_upgrade: {
        Args: {
          p_gold_cost: number
          p_item_id: string
          p_new_level: number
          p_new_stats: Json
          p_user_id: string
        }
        Returns: Json
      }
      remove_material_from_item: {
        Args: { p_item_id: string; p_slot_index: number }
        Returns: Json
      }
      replace_material_on_item: {
        Args: {
          p_item_id: string
          p_new_material_id: string
          p_new_style_id: string
          p_slot_index: number
          p_user_id: string
        }
        Returns: Json
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unequip_item: {
        Args: { p_slot_name: string; p_user_id: string }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_combat_history: {
        Args: { p_location_id: string; p_result: string; p_user_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "anonymous" | "email"
      actor: "player" | "enemy" | "system"
      combat_result: "victory" | "defeat" | "escape" | "abandoned"
      equip_slot:
        | "weapon"
        | "offhand"
        | "head"
        | "chest"
        | "legs"
        | "hands"
        | "feet"
        | "ring"
        | "amulet"
      hit_band: "injure" | "miss" | "graze" | "normal" | "crit"
      rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
      reward_type: "gold" | "feature_unlock" | "cosmetic"
      weapon_pattern:
        | "single_arc"
        | "dual_arcs"
        | "pulsing_arc"
        | "roulette"
        | "sawtooth"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: ["anonymous", "email"],
      actor: ["player", "enemy", "system"],
      combat_result: ["victory", "defeat", "escape", "abandoned"],
      equip_slot: [
        "weapon",
        "offhand",
        "head",
        "chest",
        "legs",
        "hands",
        "feet",
        "ring",
        "amulet",
      ],
      hit_band: ["injure", "miss", "graze", "normal", "crit"],
      rarity: ["common", "uncommon", "rare", "epic", "legendary"],
      reward_type: ["gold", "feature_unlock", "cosmetic"],
      weapon_pattern: [
        "single_arc",
        "dual_arcs",
        "pulsing_arc",
        "roulette",
        "sawtooth",
      ],
    },
  },
} as const
