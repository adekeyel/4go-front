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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ad_banners: {
        Row: {
          advertiser_id: string | null
          budget: number
          clicks: number
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          impressions: number
          placements: string[]
          position: string
          status: string
          target_url: string
        }
        Insert: {
          advertiser_id?: string | null
          budget?: number
          clicks?: number
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          impressions?: number
          placements?: string[]
          position?: string
          status?: string
          target_url: string
        }
        Update: {
          advertiser_id?: string | null
          budget?: number
          clicks?: number
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          impressions?: number
          placements?: string[]
          position?: string
          status?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_banners_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_label: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_label?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_label?: string | null
        }
        Relationships: []
      }
      advertisers: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          category: string
          created_at: string
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          created_at?: string
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      broadcast_deliveries: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error_sample: string | null
          failure_count: number
          id: string
          sent_by: string | null
          success_count: number
          target_count: number
          title: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          error_sample?: string | null
          failure_count?: number
          id?: string
          sent_by?: string | null
          success_count?: number
          target_count?: number
          title?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          error_sample?: string | null
          failure_count?: number
          id?: string
          sent_by?: string | null
          success_count?: number
          target_count?: number
          title?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          created_at: string
          duration_seconds: number
          id: string
          room_id: string
          status: string
        }
        Insert: {
          call_type: string
          callee_id: string
          caller_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          room_id: string
          status: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          room_id?: string
          status?: string
        }
        Relationships: []
      }
      coin_purchases: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contest_participants: {
        Row: {
          contest_id: string
          id: string
          joined_at: string
          minutes_at_join: number
          rewarded: boolean
          rewarded_at: string | null
          user_id: string
        }
        Insert: {
          contest_id: string
          id?: string
          joined_at?: string
          minutes_at_join?: number
          rewarded?: boolean
          rewarded_at?: string | null
          user_id: string
        }
        Update: {
          contest_id?: string
          id?: string
          joined_at?: string
          minutes_at_join?: number
          rewarded?: boolean
          rewarded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_participants_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contests: {
        Row: {
          created_at: string
          created_by: string
          criteria: string
          criteria_label: string | null
          description: string | null
          ends_at: string | null
          id: string
          max_winners: number | null
          reward_amount: number
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          criteria?: string
          criteria_label?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          max_winners?: number | null
          reward_amount?: number
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          criteria?: string
          criteria_label?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          max_winners?: number | null
          reward_amount?: number
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_claims: {
        Row: {
          claimed_at: string
          id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      device_contacts: {
        Row: {
          contact_name: string | null
          created_at: string
          id: string
          owner_id: string
          phone_hash: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          id?: string
          owner_id: string
          phone_hash: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          phone_hash?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_activity_log: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          employee_id: string
          id: string
          meta: Json
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          employee_id: string
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          employee_id?: string
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      employee_notifications: {
        Row: {
          body: string
          created_at: string
          employee_id: string
          id: string
          invited_user_id: string | null
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          employee_id: string
          id?: string
          invited_user_id?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          employee_id?: string
          id?: string
          invited_user_id?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          receiver_id: string
          room_id: string | null
          sender_id: string
          treasure_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          receiver_id: string
          room_id?: string | null
          sender_id: string
          treasure_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          receiver_id?: string
          room_id?: string | null
          sender_id?: string
          treasure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_treasure_id_fkey"
            columns: ["treasure_id"]
            isOneToOne: false
            referencedRelation: "treasures"
            referencedColumns: ["id"]
          },
        ]
      }
      global_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          priority: string
          sent_by: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          priority?: string
          sent_by: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          priority?: string
          sent_by?: string
          title?: string
        }
        Relationships: []
      }
      mentions: {
        Row: {
          context_id: string | null
          created_at: string
          id: string
          mentioned_user_id: string
          mentioner_id: string
          preview: string | null
          read_at: string | null
          source_id: string
          source_type: string
        }
        Insert: {
          context_id?: string | null
          created_at?: string
          id?: string
          mentioned_user_id: string
          mentioner_id: string
          preview?: string | null
          read_at?: string | null
          source_id: string
          source_type: string
        }
        Update: {
          context_id?: string | null
          created_at?: string
          id?: string
          mentioned_user_id?: string
          mentioner_id?: string
          preview?: string | null
          read_at?: string | null
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      message_views: {
        Row: {
          id: string
          message_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_views_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          duration: number | null
          edited_at: string | null
          id: string
          media_url: string | null
          reply_to: string | null
          room_id: string
          sender_id: string
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration?: number | null
          edited_at?: string | null
          id?: string
          media_url?: string | null
          reply_to?: string | null
          room_id: string
          sender_id: string
          type?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration?: number | null
          edited_at?: string | null
          id?: string
          media_url?: string | null
          reply_to?: string | null
          room_id?: string
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_message_id: string | null
          target_room_id: string | null
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_message_id?: string | null
          target_room_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_message_id?: string | null
          target_room_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      muted_members: {
        Row: {
          id: string
          muted_at: string
          muted_by: string
          muted_until: string | null
          reason: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          muted_at?: string
          muted_by: string
          muted_until?: string | null
          reason?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          muted_at?: string
          muted_by?: string
          muted_until?: string | null
          reason?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muted_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "global_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      page_followers: {
        Row: {
          followed_at: string
          id: string
          page_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string
          id?: string
          page_id: string
          user_id: string
        }
        Update: {
          followed_at?: string
          id?: string
          page_id?: string
          user_id?: string
        }
        Relationships: []
      }
      page_post_unique_views: {
        Row: {
          id: string
          post_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          post_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          post_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: []
      }
      page_posts: {
        Row: {
          author_id: string
          comments_count: number
          content: string | null
          created_at: string
          id: string
          likes_count: number
          media_type: string
          media_url: string | null
          page_id: string
          saves_count: number
          unique_views_count: number
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id: string
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string
          media_url?: string | null
          page_id: string
          saves_count?: number
          unique_views_count?: number
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          media_type?: string
          media_url?: string | null
          page_id?: string
          saves_count?: number
          unique_views_count?: number
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      pages: {
        Row: {
          about: string | null
          category: string | null
          cover_image: string | null
          created_at: string
          followers_count: number
          id: string
          is_monetized: boolean
          name: string
          owner_id: string
          profile_image: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          category?: string | null
          cover_image?: string | null
          created_at?: string
          followers_count?: number
          id?: string
          is_monetized?: boolean
          name: string
          owner_id: string
          profile_image?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          category?: string | null
          cover_image?: string | null
          created_at?: string
          followers_count?: number
          id?: string
          is_monetized?: boolean
          name?: string
          owner_id?: string
          profile_image?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string
          room_id: string
        }
        Insert: {
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
          room_id: string
        }
        Update: {
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      post_boosts: {
        Row: {
          coins_spent: number
          created_at: string
          duration_hours: number
          ends_at: string
          id: string
          owner_id: string
          plan: string
          post_id: string
          reach_count: number
          reach_target: number
          started_at: string
          status: string
        }
        Insert: {
          coins_spent: number
          created_at?: string
          duration_hours: number
          ends_at: string
          id?: string
          owner_id: string
          plan: string
          post_id: string
          reach_count?: number
          reach_target: number
          started_at?: string
          status?: string
        }
        Update: {
          coins_spent?: number
          created_at?: string
          duration_hours?: number
          ends_at?: string
          id?: string
          owner_id?: string
          plan?: string
          post_id?: string
          reach_count?: number
          reach_target?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_saves: {
        Row: {
          id: string
          post_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          post_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          post_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          comments_count: number
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          coins: number
          created_at: string
          display_name: string | null
          earned_coins: number
          id: string
          interests: string[] | null
          is_monetized: boolean
          is_online: boolean | null
          is_premium: boolean
          is_suspended: boolean
          is_verified: boolean
          last_seen: string | null
          phone_number: string | null
          purchased_coins: number
          rank: string
          referral_code: string | null
          reward_coins: number
          suspended_at: string | null
          suspended_reason: string | null
          total_online_minutes: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          earned_coins?: number
          id?: string
          interests?: string[] | null
          is_monetized?: boolean
          is_online?: boolean | null
          is_premium?: boolean
          is_suspended?: boolean
          is_verified?: boolean
          last_seen?: string | null
          phone_number?: string | null
          purchased_coins?: number
          rank?: string
          referral_code?: string | null
          reward_coins?: number
          suspended_at?: string | null
          suspended_reason?: string | null
          total_online_minutes?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          earned_coins?: number
          id?: string
          interests?: string[] | null
          is_monetized?: boolean
          is_online?: boolean | null
          is_premium?: boolean
          is_suspended?: boolean
          is_verified?: boolean
          last_seen?: string | null
          phone_number?: string | null
          purchased_coins?: number
          rank?: string
          referral_code?: string | null
          reward_coins?: number
          suspended_at?: string | null
          suspended_reason?: string | null
          total_online_minutes?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          coins_rewarded: number
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          coins_rewarded?: number
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          coins_rewarded?: number
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      room_join_requests: {
        Row: {
          answers: string[] | null
          created_at: string
          fee_paid: number
          id: string
          room_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: string[] | null
          created_at?: string
          fee_paid?: number
          id?: string
          room_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: string[] | null
          created_at?: string
          fee_paid?: number
          id?: string
          room_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_join_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reads: {
        Row: {
          id: string
          last_read_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          join_fee: number
          join_questions: string[] | null
          max_members: number | null
          name: string
          rules: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          join_fee?: number
          join_questions?: string[] | null
          max_members?: number | null
          name: string
          rules?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          join_fee?: number
          join_questions?: string[] | null
          max_members?: number | null
          name?: string
          rules?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      status_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          id: string
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          bg_color: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_url: string | null
          text_content: string | null
          type: string
          user_id: string
        }
        Insert: {
          bg_color?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string | null
          text_content?: string | null
          type: string
          user_id: string
        }
        Update: {
          bg_color?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string | null
          text_content?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_ngn: number
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          payment_ref: string | null
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_ngn: number
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          payment_ref?: string | null
          plan: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_ngn?: number
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          payment_ref?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          assigned_agent_id: string | null
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string
          status: string
          subject: string | null
          unread_for_agent: number
          unread_for_user: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          status?: string
          subject?: string | null
          unread_for_agent?: number
          unread_for_user?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          status?: string
          subject?: string | null
          unread_for_agent?: number
          unread_for_user?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_agent: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_agent?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_agent?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      treasures: {
        Row: {
          description: string | null
          icon: string
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          description?: string | null
          icon: string
          id?: string
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          description?: string | null
          icon?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      verification_applications: {
        Row: {
          amount_ngn: number
          applied_at: string
          created_at: string
          id: string
          is_verified: boolean
          payment_ref: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_ngn?: number
          applied_at?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          payment_ref?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_ngn?: number
          applied_at?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          payment_ref?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_code: string
          created_at: string
          flutterwave_ref: string | null
          id: string
          naira_amount: number
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_code: string
          created_at?: string
          flutterwave_ref?: string | null
          id?: string
          naira_amount: number
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_code?: string
          created_at?: string
          flutterwave_ref?: string | null
          id?: string
          naira_amount?: number
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_premium: {
        Args: {
          p_amount: number
          p_payment_ref: string
          p_plan: string
          p_user_id: string
        }
        Returns: string
      }
      add_page_post_comment: {
        Args: {
          p_content: string
          p_parent_id?: string
          p_post_id: string
          p_user_id: string
        }
        Returns: string
      }
      add_post_comment: {
        Args: {
          p_content: string
          p_parent_id?: string
          p_post_id: string
          p_user_id: string
        }
        Returns: string
      }
      admin_active_users_list: {
        Args: { p_admin_id: string; p_days: number }
        Returns: {
          avatar_url: string
          display_name: string
          is_online: boolean
          last_seen: string
          user_id: string
          username: string
        }[]
      }
      admin_active_users_windows: {
        Args: { p_admin_id: string }
        Returns: Json
      }
      admin_add_admin: {
        Args: { p_admin_id: string; p_role?: string; p_target: string }
        Returns: boolean
      }
      admin_complete_withdrawal: {
        Args: { p_admin_id: string; p_withdrawal_id: string }
        Returns: undefined
      }
      admin_daily_metrics: {
        Args: { p_admin_id: string; p_days?: number }
        Returns: {
          active_users: number
          day: string
          messages: number
          new_subs: number
          new_users: number
        }[]
      }
      admin_devices: {
        Args: { p_admin_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          endpoint: string
          id: string
          is_online: boolean
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      admin_email_campaign_stats: {
        Args: { p_since?: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      admin_employee_activity_log: {
        Args: {
          p_admin_id: string
          p_employee?: string
          p_from?: string
          p_limit?: number
          p_to?: string
        }
        Returns: {
          action: string
          avatar_url: string
          created_at: string
          detail: string
          employee_id: string
          employee_name: string
          employee_username: string
          id: string
          meta: Json
        }[]
      }
      admin_flagged_accounts: {
        Args: { p_admin_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_suspended: boolean
          last_reported: string
          report_count: number
          user_id: string
          username: string
        }[]
      }
      admin_get_chat_activity: {
        Args: { p_admin_id: string; p_days?: number; p_limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          is_online: boolean
          is_suspended: boolean
          message_count: number
          rank: string
          total_online_minutes: number
          user_id: string
          username: string
        }[]
      }
      admin_list_admins: {
        Args: { p_admin_id: string }
        Returns: {
          admin_since: string
          avatar_url: string
          display_name: string
          phone_number: string
          role: string
          user_id: string
          username: string
        }[]
      }
      admin_list_employees: {
        Args: { p_admin_id: string }
        Returns: {
          active_30: number
          active_7: number
          avatar_url: string
          display_name: string
          employee_since: string
          phone_number: string
          total_invited: number
          user_id: string
          username: string
        }[]
      }
      admin_message_type_breakdown: {
        Args: { p_admin_id: string }
        Returns: {
          count: number
          type: string
        }[]
      }
      admin_platform_stats: { Args: { p_admin_id: string }; Returns: Json }
      admin_reject_withdrawal: {
        Args: { p_admin_id: string; p_withdrawal_id: string }
        Returns: undefined
      }
      admin_remove_admin: {
        Args: { p_admin_id: string; p_target: string }
        Returns: boolean
      }
      admin_reported_messages: {
        Args: { p_admin_id: string; p_types: string[] }
        Returns: {
          content: string
          details: string
          media_url: string
          message_id: string
          message_type: string
          reason: string
          report_id: string
          reported_at: string
          reporter_id: string
          reporter_name: string
          room_id: string
          sender_id: string
          sender_name: string
          sender_username: string
          status: string
        }[]
      }
      admin_security_overview: { Args: { p_admin_id: string }; Returns: Json }
      admin_set_monetized: {
        Args: { p_admin_id: string; p_user: string; p_value: boolean }
        Returns: undefined
      }
      admin_suspend_user: {
        Args: { p_admin_id: string; p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_unsuspend_user: {
        Args: { p_admin_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_user_detail: {
        Args: { p_admin_id: string; p_user: string }
        Returns: Json
      }
      approve_join_request: {
        Args: { p_admin_id: string; p_request_id: string }
        Returns: undefined
      }
      approve_verification: {
        Args: { p_admin_id: string; p_application_id: string; p_notes?: string }
        Returns: undefined
      }
      are_friends: { Args: { u1: string; u2: string }; Returns: boolean }
      boost_page_post: {
        Args: { p_plan: string; p_post_id: string; p_user_id: string }
        Returns: string
      }
      buy_coins: {
        Args: { p_amount: number; p_payment_ref: string; p_user_id: string }
        Returns: undefined
      }
      calculate_rank: { Args: { minutes: number }; Returns: string }
      can_moderate: { Args: { p_user_id: string }; Returns: boolean }
      can_send_room_message: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      can_support: { Args: { p_user_id: string }; Returns: boolean }
      claim_daily_reward: { Args: { p_user_id: string }; Returns: Json }
      cleanup_stale_presence: { Args: never; Returns: undefined }
      create_page: {
        Args: {
          p_about: string
          p_category: string
          p_cover_image: string
          p_name: string
          p_owner_id: string
          p_profile_image: string
        }
        Returns: string
      }
      credit_reward_coins: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: undefined
      }
      debit_user_coins: {
        Args: {
          p_amount: number
          p_protect_withdrawable?: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      edit_post_comment: {
        Args: { p_comment_id: string; p_content: string; p_user_id: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      employee_downline: {
        Args: { p_caller: string; p_employee: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_online: boolean
          joined_at: string
          last_seen: string
          referrer_id: string
          referrer_name: string
          referrer_username: string
          user_id: string
          username: string
        }[]
      }
      employee_invited_users: {
        Args: { p_caller: string; p_employee: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_online: boolean
          joined_at: string
          last_seen: string
          rank: string
          sub_referrals: number
          user_id: string
          username: string
        }[]
      }
      employee_pipeline_stats: {
        Args: { p_caller: string; p_employee: string }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_unsub_token: { Args: { p_email: string }; Returns: string }
      find_contact_matches: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          avatar_url: string
          contact_name: string
          display_name: string
          has_pending_request: boolean
          is_friend: boolean
          user_id: string
          username: string
        }[]
      }
      follow_page: {
        Args: { p_page_id: string; p_user_id: string }
        Returns: undefined
      }
      forward_page_post_to_room: {
        Args: {
          p_note?: string
          p_post_id: string
          p_room_id: string
          p_user_id: string
        }
        Returns: string
      }
      forward_post_to_room: {
        Args: {
          p_note?: string
          p_post_id: string
          p_room_id: string
          p_user_id: string
        }
        Returns: string
      }
      get_admin_role: { Args: { p_user_id: string }; Returns: string }
      get_contest_leaderboard: {
        Args: { p_contest_id: string }
        Returns: {
          avatar_url: string
          criteria: string
          display_name: string
          joined_at: string
          online_minutes_since_join: number
          rank: string
          rewarded: boolean
          rewarded_at: string
          score: number
          user_id: string
          username: string
        }[]
      }
      get_feed_posts: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          avatar_url: string
          comments_count: number
          content: string
          created_at: string
          display_name: string
          feed_score: number
          id: string
          image_url: string
          is_liked: boolean
          likes_count: number
          rank: string
          user_id: string
          username: string
        }[]
      }
      get_or_create_dm_room: {
        Args: { user1_id: string; user2_id: string }
        Returns: string
      }
      get_page_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          author_id: string
          comments_count: number
          content: string
          created_at: string
          id: string
          is_boosted: boolean
          is_followed: boolean
          is_liked: boolean
          is_saved: boolean
          likes_count: number
          media_type: string
          media_url: string
          page_avatar: string
          page_id: string
          page_name: string
          saves_count: number
          score: number
          unique_views_count: number
          views_count: number
        }[]
      }
      get_people_you_may_know: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          mutual_friends: number
          shared_rooms: number
          user_id: string
          username: string
        }[]
      }
      get_room_member_counts: {
        Args: { p_room_ids: string[] }
        Returns: {
          member_count: number
          room_id: string
        }[]
      }
      get_unread_counts: {
        Args: { p_user_id: string }
        Returns: {
          room_id: string
          unread_count: number
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      has_admin_access: { Args: { p_user_id: string }; Returns: boolean }
      increment_online_minutes: {
        Args: { p_minutes?: number; p_user_id: string }
        Returns: undefined
      }
      is_blocked_between: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      is_premium: { Args: { p_user_id: string }; Returns: boolean }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_verified: { Args: { p_user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_actor: string
          p_details?: Json
          p_target: string
          p_target_label: string
        }
        Returns: undefined
      }
      log_employee_activity: {
        Args: {
          p_action: string
          p_detail?: string
          p_employee: string
          p_meta?: Json
        }
        Returns: undefined
      }
      mark_employee_notifications_read: {
        Args: { p_employee: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      process_referral: {
        Args: { p_new_user_id: string; p_referral_code: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_profile_flags: { Args: { p_user: string }; Returns: undefined }
      record_mentions: {
        Args: {
          p_context_id: string
          p_mentioned_ids: string[]
          p_mentioner_id: string
          p_preview: string
          p_source_id: string
          p_source_type: string
        }
        Returns: undefined
      }
      record_message_view: {
        Args: { p_message_id: string; p_user_id: string }
        Returns: Json
      }
      record_page_post_view: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: Json
      }
      refund_earned_coins: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: undefined
      }
      reject_join_request: {
        Args: { p_admin_id: string; p_request_id: string }
        Returns: undefined
      }
      reject_verification: {
        Args: { p_admin_id: string; p_application_id: string; p_notes?: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: {
          p_account_name: string
          p_account_number: string
          p_amount: number
          p_bank_code: string
          p_user_id: string
        }
        Returns: string
      }
      resend_failed_broadcast_emails: { Args: never; Returns: number }
      reward_contest_participant: {
        Args: { p_admin_id: string; p_contest_id: string; p_user_id: string }
        Returns: undefined
      }
      search_mentionable_users: {
        Args: {
          p_limit?: number
          p_query: string
          p_room_id?: string
          p_user_id: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          priority: number
          user_id: string
          username: string
        }[]
      }
      send_gift: {
        Args: {
          p_receiver_id: string
          p_room_id?: string
          p_sender_id: string
          p_treasure_id: string
        }
        Returns: undefined
      }
      send_gift_to_post: {
        Args: {
          p_message_id: string
          p_receiver_id: string
          p_room_id?: string
          p_sender_id: string
          p_treasure_id: string
        }
        Returns: undefined
      }
      set_support_status: {
        Args: { p_agent_id: string; p_conv: string; p_status: string }
        Returns: undefined
      }
      spend_coins_for_progress:
        | { Args: { p_user_id: string }; Returns: Json }
        | { Args: { p_amount?: number; p_user_id: string }; Returns: Json }
      submit_verification_application: {
        Args: { p_amount: number; p_payment_ref: string; p_user_id: string }
        Returns: string
      }
      toggle_page_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: Json
      }
      toggle_post_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: Json
      }
      track_ad_event: {
        Args: { p_banner_id: string; p_event: string }
        Returns: undefined
      }
      unfollow_page: {
        Args: { p_page_id: string; p_user_id: string }
        Returns: undefined
      }
      verify_reset_phone: {
        Args: { p_email: string; p_phone: string }
        Returns: boolean
      }
    }
    Enums: {
      admin_role: "super_admin" | "moderator" | "support" | "employee"
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
      admin_role: ["super_admin", "moderator", "support", "employee"],
    },
  },
} as const
