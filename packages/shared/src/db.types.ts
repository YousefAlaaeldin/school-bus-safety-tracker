
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "absence_reports": {
                  Row: {
                    "created_at": string,"direction": Database["public"]['Enums']["trip_direction"],"id": string,"reason": string | null,"reported_by": string | null,"service_date": string,"student_id": string
                  }
                  Insert: {
                    "created_at"?: string,"direction": Database["public"]['Enums']["trip_direction"],"id"?: string,"reason"?: string | null,"reported_by"?: string | null,"service_date": string,"student_id": string
                  }
                  Update: {
                    "created_at"?: string,"direction"?: Database["public"]['Enums']["trip_direction"],"id"?: string,"reason"?: string | null,"reported_by"?: string | null,"service_date"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absence_reports_reported_by_fkey"
      columns: ["reported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_reports_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "acknowledged_at": string | null,"acknowledged_by": string | null,"created_at": string,"dedupe_key": string,"id": string,"payload": NonNullable<Json>,"school_id": string,"severity": Database["public"]['Enums']["alert_severity"],"trip_id": string | null,"type": Database["public"]['Enums']["alert_type"]
                  }
                  Insert: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"created_at"?: string,"dedupe_key": string,"id"?: string,"payload"?: NonNullable<Json>,"school_id": string,"severity": Database["public"]['Enums']["alert_severity"],"trip_id"?: string | null,"type": Database["public"]['Enums']["alert_type"]
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"payload"?: NonNullable<Json>,"school_id"?: string,"severity"?: Database["public"]['Enums']["alert_severity"],"trip_id"?: string | null,"type"?: Database["public"]['Enums']["alert_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_acknowledged_by_fkey"
      columns: ["acknowledged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"bus_positions": {
                  Row: {
                    "accuracy_m": number | null,"heading": number | null,"lat": number,"lng": number,"location": unknown,"recorded_at": string,"school_id": string,"speed_mps": number | null,"trip_id": string,"updated_at": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"lat": number,"lng": number,"location": unknown,"recorded_at": string,"school_id": string,"speed_mps"?: number | null,"trip_id": string,"updated_at"?: string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"lat"?: number,"lng"?: number,"location"?: unknown,"recorded_at"?: string,"school_id"?: string,"speed_mps"?: number | null,"trip_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bus_positions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bus_positions_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: true
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"buses": {
                  Row: {
                    "capacity": number | null,"created_at": string,"id": string,"label_ar": string,"label_en": string,"plate": string | null,"school_id": string
                  }
                  Insert: {
                    "capacity"?: number | null,"created_at"?: string,"id"?: string,"label_ar": string,"label_en": string,"plate"?: string | null,"school_id": string
                  }
                  Update: {
                    "capacity"?: number | null,"created_at"?: string,"id"?: string,"label_ar"?: string,"label_en"?: string,"plate"?: string | null,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "buses_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"client_actions": {
                  Row: {
                    "created_at": string,"id": string,"result": NonNullable<Json>,"rpc": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"result"?: NonNullable<Json>,"rpc": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"result"?: NonNullable<Json>,"rpc"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_actions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guardian_links": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"can_track": boolean,"created_at": string,"guardian_phone": string,"guardian_user_id": string | null,"id": string,"relationship": string,"school_id": string,"status": Database["public"]['Enums']["link_status"],"student_id": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"can_track"?: boolean,"created_at"?: string,"guardian_phone": string,"guardian_user_id"?: string | null,"id"?: string,"relationship"?: string,"school_id": string,"status"?: Database["public"]['Enums']["link_status"],"student_id": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"can_track"?: boolean,"created_at"?: string,"guardian_phone"?: string,"guardian_user_id"?: string | null,"id"?: string,"relationship"?: string,"school_id"?: string,"status"?: Database["public"]['Enums']["link_status"],"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardian_links_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardian_links_guardian_user_id_fkey"
      columns: ["guardian_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardian_links_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardian_links_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"invite_codes": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"guardian_link_id": string,"id": string,"redeemed_at": string | null,"redeemed_by": string | null
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at"?: string,"guardian_link_id": string,"id"?: string,"redeemed_at"?: string | null,"redeemed_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"guardian_link_id"?: string,"id"?: string,"redeemed_at"?: string | null,"redeemed_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_codes_guardian_link_id_fkey"
      columns: ["guardian_link_id"]
isOneToOne: false
      referencedRelation: "guardian_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_codes_redeemed_by_fkey"
      columns: ["redeemed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"location_pings": {
                  Row: {
                    "accuracy_m": number | null,"heading": number | null,"id": number,"location": unknown,"received_at": string,"recorded_at": string,"speed_mps": number | null,"trip_id": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"id"?: never,"location": unknown,"received_at"?: string,"recorded_at": string,"speed_mps"?: number | null,"trip_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"id"?: never,"location"?: unknown,"received_at"?: string,"recorded_at"?: string,"speed_mps"?: number | null,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_pings_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["membership_role"],"school_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["membership_role"],"school_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["membership_role"],"school_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"claimed_at": string | null,"created_at": string,"dedupe_key": string,"error": string | null,"expo_ticket_ids": (string)[],"id": string,"params": NonNullable<Json>,"receipts_checked_at": string | null,"recipient_user_id": string,"school_id": string,"send_after": string,"sent_at": string | null,"sent_tokens": (string)[],"status": Database["public"]['Enums']["notification_status"],"student_id": string | null,"trip_id": string | null,"type": Database["public"]['Enums']["notification_type"]
                  }
                  Insert: {
                    "attempts"?: number,"claimed_at"?: string | null,"created_at"?: string,"dedupe_key": string,"error"?: string | null,"expo_ticket_ids"?: (string)[],"id"?: string,"params"?: NonNullable<Json>,"receipts_checked_at"?: string | null,"recipient_user_id": string,"school_id": string,"send_after"?: string,"sent_at"?: string | null,"sent_tokens"?: (string)[],"status"?: Database["public"]['Enums']["notification_status"],"student_id"?: string | null,"trip_id"?: string | null,"type": Database["public"]['Enums']["notification_type"]
                  }
                  Update: {
                    "attempts"?: number,"claimed_at"?: string | null,"created_at"?: string,"dedupe_key"?: string,"error"?: string | null,"expo_ticket_ids"?: (string)[],"id"?: string,"params"?: NonNullable<Json>,"receipts_checked_at"?: string | null,"recipient_user_id"?: string,"school_id"?: string,"send_after"?: string,"sent_at"?: string | null,"sent_tokens"?: (string)[],"status"?: Database["public"]['Enums']["notification_status"],"student_id"?: string | null,"trip_id"?: string | null,"type"?: Database["public"]['Enums']["notification_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_recipient_user_id_fkey"
      columns: ["recipient_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_outbox_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"email": string | null,"id": string,"locale": Database["public"]['Enums']["locale_code"],"phone": string | null
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id": string,"locale"?: Database["public"]['Enums']["locale_code"],"phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"expo_token": string,"id": string,"last_seen_at": string,"platform": Database["public"]['Enums']["device_platform"],"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expo_token": string,"id"?: string,"last_seen_at"?: string,"platform": Database["public"]['Enums']["device_platform"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expo_token"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"route_schedules": {
                  Row: {
                    "departure_time": string,"route_id": string,"weekday": number
                  }
                  Insert: {
                    "departure_time": string,"route_id": string,"weekday": number
                  }
                  Update: {
                    "departure_time"?: string,"route_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "route_schedules_route_id_fkey"
      columns: ["route_id"]
isOneToOne: false
      referencedRelation: "routes"
      referencedColumns: ["id"]
    }
                  ]
                },"route_stops": {
                  Row: {
                    "route_id": string,"sequence": number,"stop_id": string
                  }
                  Insert: {
                    "route_id": string,"sequence": number,"stop_id": string
                  }
                  Update: {
                    "route_id"?: string,"sequence"?: number,"stop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "route_stops_route_id_fkey"
      columns: ["route_id"]
isOneToOne: false
      referencedRelation: "routes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "route_stops_stop_id_fkey"
      columns: ["stop_id"]
isOneToOne: false
      referencedRelation: "stops"
      referencedColumns: ["id"]
    }
                  ]
                },"routes": {
                  Row: {
                    "active": boolean,"bus_id": string,"created_at": string,"default_helper_id": string | null,"direction": Database["public"]['Enums']["trip_direction"],"id": string,"name_ar": string,"name_en": string,"school_id": string
                  }
                  Insert: {
                    "active"?: boolean,"bus_id": string,"created_at"?: string,"default_helper_id"?: string | null,"direction": Database["public"]['Enums']["trip_direction"],"id"?: string,"name_ar": string,"name_en": string,"school_id": string
                  }
                  Update: {
                    "active"?: boolean,"bus_id"?: string,"created_at"?: string,"default_helper_id"?: string | null,"direction"?: Database["public"]['Enums']["trip_direction"],"id"?: string,"name_ar"?: string,"name_en"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routes_bus_id_fkey"
      columns: ["bus_id"]
isOneToOne: false
      referencedRelation: "buses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routes_default_helper_id_fkey"
      columns: ["default_helper_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"school_calendar": {
                  Row: {
                    "am_departure_override": string | null,"created_at": string,"date": string,"id": string,"note": string | null,"pm_departure_override": string | null,"school_id": string,"type": Database["public"]['Enums']["calendar_day_type"]
                  }
                  Insert: {
                    "am_departure_override"?: string | null,"created_at"?: string,"date": string,"id"?: string,"note"?: string | null,"pm_departure_override"?: string | null,"school_id": string,"type": Database["public"]['Enums']["calendar_day_type"]
                  }
                  Update: {
                    "am_departure_override"?: string | null,"created_at"?: string,"date"?: string,"id"?: string,"note"?: string | null,"pm_departure_override"?: string | null,"school_id"?: string,"type"?: Database["public"]['Enums']["calendar_day_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_calendar_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "absence_cutoff_minutes": number,"created_at": string,"drop_distance_warning_m": number,"emirate": string,"eta_alert_minutes": number,"id": string,"location_retention_days": number,"name_ar": string,"name_en": string,"notify_parent_on_missing": boolean,"timezone": string,"weekend_days": (number)[]
                  }
                  Insert: {
                    "absence_cutoff_minutes"?: number,"created_at"?: string,"drop_distance_warning_m"?: number,"emirate": string,"eta_alert_minutes"?: number,"id"?: string,"location_retention_days"?: number,"name_ar": string,"name_en": string,"notify_parent_on_missing"?: boolean,"timezone"?: string,"weekend_days"?: (number)[]
                  }
                  Update: {
                    "absence_cutoff_minutes"?: number,"created_at"?: string,"drop_distance_warning_m"?: number,"emirate"?: string,"eta_alert_minutes"?: number,"id"?: string,"location_retention_days"?: number,"name_ar"?: string,"name_en"?: string,"notify_parent_on_missing"?: boolean,"timezone"?: string,"weekend_days"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"staff_invites": {
                  Row: {
                    "claimed_at": string | null,"claimed_by": string | null,"created_at": string,"display_name": string | null,"email": string | null,"id": string,"phone": string | null,"role": Database["public"]['Enums']["membership_role"],"school_id": string
                  }
                  Insert: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"phone"?: string | null,"role": Database["public"]['Enums']["membership_role"],"school_id": string
                  }
                  Update: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["membership_role"],"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invites_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invites_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"stops": {
                  Row: {
                    "area": string | null,"building": string | null,"created_at": string,"id": string,"is_school": boolean,"label_ar": string,"label_en": string,"landmark_notes": string | null,"location": unknown,"makani_number": string | null,"school_id": string
                  }
                  Insert: {
                    "area"?: string | null,"building"?: string | null,"created_at"?: string,"id"?: string,"is_school"?: boolean,"label_ar": string,"label_en": string,"landmark_notes"?: string | null,"location": unknown,"makani_number"?: string | null,"school_id": string
                  }
                  Update: {
                    "area"?: string | null,"building"?: string | null,"created_at"?: string,"id"?: string,"is_school"?: boolean,"label_ar"?: string,"label_en"?: string,"landmark_notes"?: string | null,"location"?: unknown,"makani_number"?: string | null,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stops_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"student_assignments": {
                  Row: {
                    "created_at": string,"id": string,"route_id": string,"stop_id": string,"student_id": string,"valid_from": string,"valid_to": string | null,"weekdays": (number)[]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"route_id": string,"stop_id": string,"student_id": string,"valid_from"?: string,"valid_to"?: string | null,"weekdays"?: (number)[]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"route_id"?: string,"stop_id"?: string,"student_id"?: string,"valid_from"?: string,"valid_to"?: string | null,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_assignments_route_id_fkey"
      columns: ["route_id"]
isOneToOne: false
      referencedRelation: "routes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_assignments_stop_id_fkey"
      columns: ["stop_id"]
isOneToOne: false
      referencedRelation: "stops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_assignments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "active": boolean,"created_at": string,"grade": string | null,"id": string,"name_ar": string,"name_en": string,"photo_path": string | null,"school_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"grade"?: string | null,"id"?: string,"name_ar": string,"name_en": string,"photo_path"?: string | null,"school_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"grade"?: string | null,"id"?: string,"name_ar"?: string,"name_en"?: string,"photo_path"?: string | null,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_events": {
                  Row: {
                    "actor_id": string | null,"client_action_id": string | null,"device_time": string | null,"id": number,"location": unknown,"payload": NonNullable<Json>,"server_time": string,"student_id": string | null,"trip_id": string,"type": Database["public"]['Enums']["trip_event_type"]
                  }
                  Insert: {
                    "actor_id"?: string | null,"client_action_id"?: string | null,"device_time"?: string | null,"id"?: never,"location"?: unknown,"payload"?: NonNullable<Json>,"server_time"?: string,"student_id"?: string | null,"trip_id": string,"type": Database["public"]['Enums']["trip_event_type"]
                  }
                  Update: {
                    "actor_id"?: string | null,"client_action_id"?: string | null,"device_time"?: string | null,"id"?: never,"location"?: unknown,"payload"?: NonNullable<Json>,"server_time"?: string,"student_id"?: string | null,"trip_id"?: string,"type"?: Database["public"]['Enums']["trip_event_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_events_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_events_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_students": {
                  Row: {
                    "boarded_at": string | null,"boarded_location": unknown,"drop_distance_m": number | null,"dropped_at": string | null,"dropped_location": unknown,"eta_alert_sent_at": string | null,"eta_at": string | null,"eta_source": Database["public"]['Enums']["eta_source"] | null,"eta_updated_at": string | null,"id": string,"status": Database["public"]['Enums']["student_trip_status"],"stop_id": string,"stop_sequence": number,"student_id": string,"trip_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "boarded_at"?: string | null,"boarded_location"?: unknown,"drop_distance_m"?: number | null,"dropped_at"?: string | null,"dropped_location"?: unknown,"eta_alert_sent_at"?: string | null,"eta_at"?: string | null,"eta_source"?: Database["public"]['Enums']["eta_source"] | null,"eta_updated_at"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["student_trip_status"],"stop_id": string,"stop_sequence": number,"student_id": string,"trip_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "boarded_at"?: string | null,"boarded_location"?: unknown,"drop_distance_m"?: number | null,"dropped_at"?: string | null,"dropped_location"?: unknown,"eta_alert_sent_at"?: string | null,"eta_at"?: string | null,"eta_source"?: Database["public"]['Enums']["eta_source"] | null,"eta_updated_at"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["student_trip_status"],"stop_id"?: string,"stop_sequence"?: number,"student_id"?: string,"trip_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_students_stop_id_fkey"
      columns: ["stop_id"]
isOneToOne: false
      referencedRelation: "stops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_students_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_students_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_students_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "arrived_school_at": string | null,"bus_id": string,"created_at": string,"direction": Database["public"]['Enums']["trip_direction"],"end_forced": boolean,"end_reason": string | null,"ended_at": string | null,"helper_id": string | null,"id": string,"roll_call_confirmed_at": string | null,"route_id": string,"scheduled_departure": string,"school_id": string,"service_date": string,"started_at": string | null,"status": Database["public"]['Enums']["trip_status"]
                  }
                  Insert: {
                    "arrived_school_at"?: string | null,"bus_id": string,"created_at"?: string,"direction": Database["public"]['Enums']["trip_direction"],"end_forced"?: boolean,"end_reason"?: string | null,"ended_at"?: string | null,"helper_id"?: string | null,"id"?: string,"roll_call_confirmed_at"?: string | null,"route_id": string,"scheduled_departure": string,"school_id": string,"service_date": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["trip_status"]
                  }
                  Update: {
                    "arrived_school_at"?: string | null,"bus_id"?: string,"created_at"?: string,"direction"?: Database["public"]['Enums']["trip_direction"],"end_forced"?: boolean,"end_reason"?: string | null,"ended_at"?: string | null,"helper_id"?: string | null,"id"?: string,"roll_call_confirmed_at"?: string | null,"route_id"?: string,"scheduled_departure"?: string,"school_id"?: string,"service_date"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["trip_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_bus_id_fkey"
      columns: ["bus_id"]
isOneToOne: false
      referencedRelation: "buses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trips_helper_id_fkey"
      columns: ["helper_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trips_route_id_fkey"
      columns: ["route_id"]
isOneToOne: false
      referencedRelation: "routes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trips_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "acknowledge_alert":
{ Args: { "p_alert_id": string }; Returns: undefined
                           },
"approve_guardian_link":
{ Args: { "p_link_id": string }; Returns: undefined
                           },
"create_invite":
{ Args: { "p_guardian_link_id": string }; Returns: Json
                           },
"generate_trips":
{ Args: { "p_service_date": string }; Returns: number
                           },
"get_my_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"import_roster":
{ Args: { "p_rows": Json,"p_school_id": string }; Returns: Json
                           },
"invite_staff":
{ Args: { "p_display_name": string,"p_email": string,"p_phone": string,"p_role": Database["public"]['Enums']["membership_role"],"p_school_id": string }; Returns: Json
                           },
"redeem_invite":
{ Args: { "p_code": string }; Returns: Json
                           },
"remove_staff":
{ Args: { "p_membership_id": string }; Returns: undefined
                           },
"revoke_guardian_link":
{ Args: { "p_link_id": string }; Returns: undefined
                           },
"set_my_locale":
{ Args: { "p_locale": Database["public"]['Enums']["locale_code"] }; Returns: undefined
                           },
"set_trip_helper":
{ Args: { "p_helper_id": string,"p_trip_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "alert_severity": "info"|"warning"|"critical","alert_type": "roll_call_missing"|"no_show"|"student_returned"|"trip_forced_end"|"lost_contact"|"stationary"|"overdue_trip","calendar_day_type": "holiday"|"closure"|"early_dismissal"|"ramadan_hours","device_platform": "ios"|"android","eta_source": "routes_api"|"fallback","link_status": "pending"|"approved"|"revoked","locale_code": "ar"|"en","membership_role": "admin"|"helper","notification_status": "pending"|"cancelled"|"sent"|"failed","notification_type": "boarded"|"picked_up"|"no_show"|"eta_dropoff"|"eta_pickup"|"dropped"|"arrived_school"|"returned_to_school"|"missing_child"|"roll_call_missing"|"trip_forced_end"|"lost_contact"|"stationary"|"overdue_trip","student_trip_status": "expected"|"absent_reported"|"boarded"|"missing"|"dropped"|"returned_to_school","trip_direction": "to_school"|"from_school","trip_event_type": "trip_started"|"student_boarded"|"student_unboarded"|"roll_call_confirmed"|"student_dropped"|"student_drop_undone"|"student_no_show"|"student_no_show_undone"|"student_returned"|"arrived_school"|"trip_ended"|"absence_reported"|"absence_cancelled","trip_status": "scheduled"|"roll_call"|"in_progress"|"completed"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "alert_severity": ["info", "warning", "critical"],"alert_type": ["roll_call_missing", "no_show", "student_returned", "trip_forced_end", "lost_contact", "stationary", "overdue_trip"],"calendar_day_type": ["holiday", "closure", "early_dismissal", "ramadan_hours"],"device_platform": ["ios", "android"],"eta_source": ["routes_api", "fallback"],"link_status": ["pending", "approved", "revoked"],"locale_code": ["ar", "en"],"membership_role": ["admin", "helper"],"notification_status": ["pending", "cancelled", "sent", "failed"],"notification_type": ["boarded", "picked_up", "no_show", "eta_dropoff", "eta_pickup", "dropped", "arrived_school", "returned_to_school", "missing_child", "roll_call_missing", "trip_forced_end", "lost_contact", "stationary", "overdue_trip"],"student_trip_status": ["expected", "absent_reported", "boarded", "missing", "dropped", "returned_to_school"],"trip_direction": ["to_school", "from_school"],"trip_event_type": ["trip_started", "student_boarded", "student_unboarded", "roll_call_confirmed", "student_dropped", "student_drop_undone", "student_no_show", "student_no_show_undone", "student_returned", "arrived_school", "trip_ended", "absence_reported", "absence_cancelled"],"trip_status": ["scheduled", "roll_call", "in_progress", "completed", "cancelled"]
          }
        }
} as const
