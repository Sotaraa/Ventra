// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'site_admin' | 'reception' | 'teacher' | 'host'

export type PersonGroup = 'student' | 'teaching_staff' | 'non_teaching_staff' | 'contractor' | 'governor'

export type VisitorType = 'parent' | 'contractor' | 'official' | 'supplier' | 'other'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'left_early' | 'authorised_absence'

export type AbsenceType = 'sick' | 'authorised' | 'unauthorised' | 'holiday' | 'medical' | 'other'

export type VisitStatus = 'expected' | 'checked_in' | 'checked_out' | 'denied' | 'cancelled' | 'no_show'

export type DbsStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing'

export type AlertSeverity = 'info' | 'warning' | 'critical'

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface BadgeSettings {
  enabled:      boolean
  printer_type: 'browser' | 'brother' | 'dymo' | 'zebra'
  accent_color: string
  show_photo:   boolean
  show_host:    boolean
  show_purpose: boolean
  show_company: boolean
  show_time:    boolean
  show_qr:      boolean
}

export interface Site {
  id: string
  slug?: string
  name: string
  address: string
  phone?: string
  email?: string
  logo_url?: string
  timezone: string
  is_active: boolean
  tenant_id?: string
  created_at: string
  settings?: {
    badge?: Partial<BadgeSettings>
    [key: string]: unknown
  }
}

export interface UserProfile {
  id: string
  site_id: string | null   // null = trust admin (manages all schools in their tenant)
  tenant_id?: string
  auth_user_id?: string
  email: string
  full_name: string
  role: UserRole
  azure_oid?: string
  department?: string
  is_active: boolean
  last_login?: string
  created_at: string
}

export interface Person {
  id: string
  site_id: string
  group: PersonGroup
  first_name: string
  last_name: string
  full_name: string
  email?: string
  phone?: string
  photo_url?: string
  form_group?: string       // for students
  year_group?: string       // for students
  department?: string       // for staff
  employee_number?: string
  student_id?: string
  azure_oid?: string        // synced from Entra ID
  emergency_pin?: string | null
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

// ─── Visitor Management ───────────────────────────────────────────────────────

export interface Visitor {
  id: string
  site_id: string
  first_name: string
  last_name: string
  full_name: string
  email?: string
  phone?: string
  company?: string
  visitor_type: VisitorType
  photo_url?: string
  nda_signed: boolean
  nda_signed_at?: string
  notes?: string
  created_at: string
}

export interface VisitLog {
  id: string
  site_id: string
  visitor_id: string
  host_person_id?: string
  host_name?: string
  host_email?: string
  purpose?: string
  status: VisitStatus
  expected_at?: string
  checked_in_at?: string
  checked_out_at?: string
  check_out_reason?: string
  badge_printed: boolean
  badge_printed_at?: string
  denied_reason?: string
  pre_registration_token?: string
  notes?: string
  created_at: string
  updated_at: string
  // joined
  visitor?: Visitor
  host?: Person
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string
  site_id: string
  person_id: string
  date: string               // YYYY-MM-DD
  status: AttendanceStatus
  signed_in_at?: string
  signed_out_at?: string
  sign_out_reason?: string
  late_minutes?: number
  notes?: string
  marked_by?: string
  created_at: string
  updated_at: string
  // joined
  person?: Person
}

export interface AbsenceRecord {
  id: string
  site_id: string
  person_id: string
  absence_type: AbsenceType
  start_date: string
  end_date: string
  reason?: string
  parent_notified: boolean
  parent_notified_at?: string
  approved_by?: string
  approved_at?: string
  notes?: string
  created_at: string
  // joined
  person?: Person
}

// ─── Safeguarding ─────────────────────────────────────────────────────────────

export interface DbsRecord {
  id: string
  site_id: string
  person_id: string
  dbs_number: string
  issue_date: string
  expiry_date: string
  status: DbsStatus
  certificate_url?: string
  notes?: string
  created_at: string
  updated_at: string
  // joined
  person?: Person
}

export interface WatchlistEntry {
  id: string
  site_id: string
  full_name: string
  aliases?: string[]
  reason: string
  severity: AlertSeverity
  added_by: string
  is_active: boolean
  notes?: string
  created_at: string
}

// ─── Emergency ────────────────────────────────────────────────────────────────

export interface EvacuationEvent {
  id: string
  site_id: string
  triggered_by: string
  triggered_at: string
  resolved_at?: string
  total_on_site: number
  total_accounted: number
  muster_point?: string
  notes?: string
  report_url?: string
  created_at: string
}

export interface EvacuationRollCall {
  id: string
  evacuation_event_id: string
  person_id?: string
  visitor_log_id?: string
  name: string
  group: string
  accounted: boolean
  accounted_at?: string
  accounted_by?: string
}

// ─── Badges & Reports ─────────────────────────────────────────────────────────

export interface BadgeTemplate {
  id: string
  site_id: string
  name: string
  visitor_type?: VisitorType
  show_photo: boolean
  show_host: boolean
  show_company: boolean
  show_qr: boolean
  show_wifi_qr: boolean
  show_parking_code: boolean
  background_color: string
  accent_color: string
  logo_url?: string
  is_default: boolean
  created_at: string
}

export interface ReportSchedule {
  id: string
  site_id: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  day_of_week?: number       // 0=Sunday
  send_to_emails: string[]
  include_attendance: boolean
  include_visitors: boolean
  include_safeguarding: boolean
  format: 'pdf' | 'csv' | 'xlsx'
  is_active: boolean
  last_sent_at?: string
  created_at: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationLog {
  id: string
  site_id: string
  visit_log_id?: string
  recipient_email: string
  recipient_name: string
  channel: 'email' | 'teams'
  subject: string
  sent_at: string
  delivered: boolean
  error?: string
}

// ─── Dashboard / UI types ─────────────────────────────────────────────────────

export interface OccupancyCount {
  students: number
  teaching_staff: number
  non_teaching_staff: number
  contractors: number
  visitors: number
  total: number
}

export interface DashboardAlert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  created_at: string
  action_url?: string
}

export interface TodayStats {
  occupancy: OccupancyCount
  expected_visitors: number
  checked_in_visitors: number
  absent_students: number
  absent_staff: number
  alerts: DashboardAlert[]
}
