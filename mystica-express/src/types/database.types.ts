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
          applied_loot_pools: Json | null
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
          applied_loot_pools?: Json | null
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
          applied_loot_pools?: Json | null
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
          appearance_data: Json | null
          atk_offset: number
          base_atk: number
          base_def: number
          base_dialogue_prompt: string | null
          base_hp: number
          def_offset: number
          dialogue_tone: string | null
          example_taunts: Json | null
          hp_offset: number
          id: string
          name: string
          style_id: string
          tier_id: number
          verbosity: string | null
        }
        Insert: {
          ai_personality_traits?: Json | null
          appearance_data?: Json | null
          atk_offset?: number
          base_atk?: number
          base_def?: number
          base_dialogue_prompt?: string | null
          base_hp?: number
          def_offset?: number
          dialogue_tone?: string | null
          example_taunts?: Json | null
          hp_offset?: number
          id?: string
          name: string
          style_id: string
          tier_id: number
          verbosity?: string | null
        }
        Update: {
          ai_personality_traits?: Json | null
          appearance_data?: Json | null
          atk_offset?: number
          base_atk?: number
          base_def?: number
          base_dialogue_prompt?: string | null
          base_hp?: number
          def_offset?: number
          dialogue_tone?: string | null
          example_taunts?: Json | null
          hp_offset?: number
          id?: string
          name?: string
          style_id?: string
          tier_id?: number
          verbosity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_enemy_types_style"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styledefinitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_enemy_types_tier"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "tiers"
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
          generated_image_url: string | null
          id: string
          image_generation_status: string | null
          is_styled: boolean
          item_type_id: string
          level: number
          material_combo_hash: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_stats?: Json | null
          generated_image_url?: string | null
          id?: string
          image_generation_status?: string | null
          is_styled?: boolean
          item_type_id: string
          level?: number
          material_combo_hash?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_stats?: Json | null
          generated_image_url?: string | null
          id?: string
          image_generation_status?: string | null
          is_styled?: boolean
          item_type_id?: string
          level?: number
          material_combo_hash?: string | null
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
          appearance_data: Json | null
          base_stats_normalized: Json
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
        }
        Insert: {
          appearance_data?: Json | null
          base_stats_normalized: Json
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
        }
        Update: {
          appearance_data?: Json | null
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
          lat?: number
          lng?: number
          location_type?: string | null
          name?: string | null
          state_code?: string | null
        }
        Relationships: []
      }
      lootpoolentries: {
        Row: {
          created_at: string
          drop_weight: number
          id: string
          loot_pool_id: string
          lootable_id: string
          lootable_type: string
        }
        Insert: {
          created_at?: string
          drop_weight?: number
          id?: string
          loot_pool_id: string
          lootable_id: string
          lootable_type: string
        }
        Update: {
          created_at?: string
          drop_weight?: number
          id?: string
          loot_pool_id?: string
          lootable_id?: string
          lootable_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_loot_pool_entries_pool"
            columns: ["loot_pool_id"]
            isOneToOne: false
            referencedRelation: "lootpools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loot_pool_entries_pool"
            columns: ["loot_pool_id"]
            isOneToOne: false
            referencedRelation: "v_loot_pool_material_weights"
            referencedColumns: ["loot_pool_id"]
          },
        ]
      }
      lootpools: {
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
      lootpooltierweights: {
        Row: {
          created_at: string
          loot_pool_id: string
          tier_name: string
          weight_multiplier: number
        }
        Insert: {
          created_at?: string
          loot_pool_id: string
          tier_name: string
          weight_multiplier?: number
        }
        Update: {
          created_at?: string
          loot_pool_id?: string
          tier_name?: string
          weight_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_loot_pool_tier_weights_pool"
            columns: ["loot_pool_id"]
            isOneToOne: false
            referencedRelation: "lootpools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loot_pool_tier_weights_pool"
            columns: ["loot_pool_id"]
            isOneToOne: false
            referencedRelation: "v_loot_pool_material_weights"
            referencedColumns: ["loot_pool_id"]
          },
          {
            foreignKeyName: "fk_loot_pool_tier_weights_tier"
            columns: ["tier_name"]
            isOneToOne: false
            referencedRelation: "materialstrengthtiers"
            referencedColumns: ["tier_name"]
          },
          {
            foreignKeyName: "fk_loot_pool_tier_weights_tier"
            columns: ["tier_name"]
            isOneToOne: false
            referencedRelation: "v_material_tiers"
            referencedColumns: ["tier_name"]
          },
        ]
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
            referencedRelation: "v_loot_pool_material_weights"
            referencedColumns: ["material_id"]
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
            referencedRelation: "v_loot_pool_material_weights"
            referencedColumns: ["material_id"]
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
          enemy_atk_add: number
          enemy_def_add: number
          enemy_hp_add: number
          id: number
          tier_num: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          enemy_atk_add?: number
          enemy_def_add?: number
          enemy_hp_add?: number
          id?: number
          tier_num: number
        }
        Update: {
          created_at?: string
          description?: string | null
          enemy_atk_add?: number
          enemy_def_add?: number
          enemy_hp_add?: number
          id?: number
          tier_num?: number
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
          f_geography_column: unknown | null
          f_table_catalog: unknown | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown | null
          f_table_catalog: string | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_enemy_realized_stats: {
        Row: {
          atk: number | null
          combat_rating: number | null
          def: number | null
          hp: number | null
          id: string | null
          name: string | null
          tier_num: number | null
        }
        Relationships: []
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
      v_loot_pool_material_weights: {
        Row: {
          final_weight: number | null
          loot_pool_id: string | null
          material_id: string | null
        }
        Relationships: []
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
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_bestsrid: {
        Args: { "": unknown }
        Returns: number
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      _st_pointoutside: {
        Args: { "": unknown }
        Returns: unknown
      }
      _st_sortablehash: {
        Args: { geom: unknown }
        Returns: number
      }
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
      _st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      addauth: {
        Args: { "": string }
        Returns: boolean
      }
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
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
      box: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box3d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3dtobox: {
        Args: { "": unknown }
        Returns: unknown
      }
      bytea: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
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
      disablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string }
        Returns: string
      }
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string }
        Returns: string
      }
      effective_hp: {
        Args: { def_k?: number; defense: number; hp: number }
        Returns: number
      }
      enablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      equip_item: {
        Args: { p_item_id: string; p_slot_name: string; p_user_id: string }
        Returns: Json
      }
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
      geography: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      geography_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geography_gist_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_gist_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_send: {
        Args: { "": unknown }
        Returns: string
      }
      geography_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geography_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
        Returns: unknown
      }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_analyze: {
        Args: { "": unknown }
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
      geometry_gist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_hash: {
        Args: { "": unknown }
        Returns: number
      }
      geometry_in: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_out: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_recv: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_send: {
        Args: { "": unknown }
        Returns: string
      }
      geometry_sortsupport: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_spgist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_3d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geometry_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometrytype: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      get_nearby_locations: {
        Args: { search_radius: number; user_lat: number; user_lng: number }
        Returns: {
          country_code: string
          distance_meters: number
          id: string
          lat: number
          lng: number
          location_type: string
          name: string
          state_code: string
        }[]
      }
      get_proj4_from_srid: {
        Args: { "": number }
        Returns: string
      }
      gettransactionid: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      gidx_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gidx_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_craft_count: {
        Args: { cache_id: string }
        Returns: number
      }
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
      json: {
        Args: { "": unknown }
        Returns: Json
      }
      jsonb: {
        Args: { "": unknown }
        Returns: Json
      }
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      path: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      point: {
        Args: { "": unknown }
        Returns: unknown
      }
      polygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean }
        Returns: string
      }
      postgis_addbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
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
      postgis_dropbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_full_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_geos_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_geos_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_getbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_hasbbox: {
        Args: { "": unknown }
        Returns: boolean
      }
      postgis_index_supportfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_proj_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_svn_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_typmod_dims: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_srid: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_type: {
        Args: { "": number }
        Returns: string
      }
      postgis_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
      spheroid_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      spheroid_out: {
        Args: { "": unknown }
        Returns: unknown
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
      st_3dlength: {
        Args: { "": unknown }
        Returns: number
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
      st_3dperimeter: {
        Args: { "": unknown }
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
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
        Returns: number
      }
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_area2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_asbinary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
        Returns: string
      }
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_ashexewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
        Returns: string
      }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: {
        Args: { format?: string; geom: unknown }
        Returns: string
      }
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
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number }
        Returns: string
      }
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_astwkb: {
        Args:
          | {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
          | {
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
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_boundary: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number }
        Returns: unknown
      }
      st_buildarea: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_centroid: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      st_cleangeometry: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_clusterintersecting: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collectionextract: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_collectionhomogenize: {
        Args: { "": unknown }
        Returns: unknown
      }
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
      st_convexhull: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_coorddim: {
        Args: { geometry: unknown }
        Returns: number
      }
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      st_dimension: {
        Args: { "": unknown }
        Returns: number
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number }
        Returns: number
      }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dump: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumppoints: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumprings: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumpsegments: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
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
      st_endpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_envelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown }
        Returns: unknown
      }
      st_exteriorring: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_flipcoordinates: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force3d: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
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
      st_forcecollection: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcecurve: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygonccw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygoncw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcerhr: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcesfs: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number }
        Returns: unknown
      }
      st_geogfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geogfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geographyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number }
        Returns: string
      }
      st_geomcollfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomcollfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometrytype: {
        Args: { "": unknown }
        Returns: string
      }
      st_geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string }
        Returns: unknown
      }
      st_geomfromgml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromkml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfrommarc21: {
        Args: { marc21xml: string }
        Returns: unknown
      }
      st_geomfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromtwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_gmltosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_hasarc: {
        Args: { geometry: unknown }
        Returns: boolean
      }
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
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_isclosed: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_iscollection: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isempty: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygonccw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygoncw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isring: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_issimple: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvalid: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
      }
      st_isvalidreason: {
        Args: { "": unknown }
        Returns: string
      }
      st_isvalidtrajectory: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_length2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_letters: {
        Args: { font?: Json; letters: string }
        Returns: unknown
      }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefrommultipoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_linefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linemerge: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linestringfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linetocurve: {
        Args: { geometry: unknown }
        Returns: unknown
      }
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
      st_m: {
        Args: { "": unknown }
        Returns: number
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makepolygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_maximuminscribedcircle: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_memsize: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_minimumboundingradius: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_minimumclearance: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumclearanceline: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_mlinefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mlinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multi: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_multilinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multilinestringfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_ndims: {
        Args: { "": unknown }
        Returns: number
      }
      st_node: {
        Args: { g: unknown }
        Returns: unknown
      }
      st_normalize: {
        Args: { geom: unknown }
        Returns: unknown
      }
      st_npoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_nrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numgeometries: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorring: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpatches: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_orientedenvelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_perimeter2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_pointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointonsurface: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_points: {
        Args: { "": unknown }
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
      st_polyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonize: {
        Args: { "": unknown[] }
        Returns: unknown
      }
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
      st_relate: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: string
      }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_reverse: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number }
        Returns: unknown
      }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shiftlongitude: {
        Args: { "": unknown }
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
      st_split: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid: {
        Args: { geog: unknown } | { geom: unknown }
        Returns: number
      }
      st_startpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_summary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
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
      st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string }
        Returns: unknown
      }
      st_triangulatepolygon: {
        Args: { g1: unknown }
        Returns: unknown
      }
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number }
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
      st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_wkbtosql: {
        Args: { wkb: string }
        Returns: unknown
      }
      st_wkttosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      st_x: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmin: {
        Args: { "": unknown }
        Returns: number
      }
      st_y: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymax: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymin: {
        Args: { "": unknown }
        Returns: number
      }
      st_z: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmflag: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmin: {
        Args: { "": unknown }
        Returns: number
      }
      text: {
        Args: { "": unknown }
        Returns: string
      }
      unequip_item: {
        Args: { p_slot_name: string; p_user_id: string }
        Returns: Json
      }
      unlockrows: {
        Args: { "": string }
        Returns: number
      }
      update_combat_history: {
        Args: { p_location_id: string; p_result: string; p_user_id: string }
        Returns: Json
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
        geom: unknown | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown | null
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
