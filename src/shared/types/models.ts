export const ALL_FEATURES = [
  'ai_manager',
  'ai_business_report',
  'customer_management',
  'reservation_management',
  'schedule_management',
  'surveys',
  'brand_management',
  'sales_analysis',
  'order_management',
  'waiting_board',
  'contracts',
  'table_order',
] as const;

export type FeatureKey = (typeof ALL_FEATURES)[number];
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type ReservationStatus = 'booked' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type WaitingStatus = 'waiting' | 'called' | 'seated' | 'cancelled';
export type ContractStatus = 'draft' | 'sent' | 'signed';
export type ScheduleType = 'shift' | 'task' | 'meeting';
export type OrderChannel = 'table' | 'walk_in' | 'delivery' | 'reservation';
export type ReportType = 'daily' | 'weekly';
export type StoreRequestStatus = 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected';
export type StoreVisibility = 'public' | 'private';
export type SubscriptionPlan = 'starter' | 'pro' | 'business' | 'enterprise';
export type SetupPaymentStatus = 'setup_pending' | 'setup_paid';
export type SubscriptionStatus =
  | 'subscription_pending'
  | 'subscription_active'
  | 'subscription_past_due'
  | 'subscription_cancelled'
  | 'refund_requested';
export type PaymentMethodStatus = 'ready' | 'action_required' | 'missing';
export type BillingEventStatus = 'pending' | 'paid' | 'failed' | 'requested';
export type AdminUserRole = 'platform_owner' | 'platform_admin' | 'store_owner' | 'store_manager';
export type AdminUserStatus = 'active' | 'pending' | 'inactive';
export type InvitationStatus = 'sent' | 'scheduled' | 'accepted' | 'none';
export type StoreMediaType = 'hero' | 'storefront' | 'interior';
export type SystemStatusState = 'active' | 'ready' | 'warning' | 'pending' | 'error';
export type ProvisioningAction =
  | 'requested'
  | 'review_started'
  | 'approved'
  | 'rejected'
  | 'store_created'
  | 'billing_created'
  | 'owner_linked'
  | 'features_applied';
export type ProvisioningLevel = 'info' | 'success' | 'warning';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export interface StoreRequestMenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  description: string;
  is_signature: boolean;
}

export interface StoreRequestNotice {
  id: string;
  title: string;
  content: string;
}

export interface StoreRequest {
  id: string;
  business_name: string;
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
  requested_slug: string;
  requested_plan: SubscriptionPlan;
  selected_features: FeatureKey[];
  brand_name: string;
  brand_color: string;
  tagline: string;
  description: string;
  hero_image_url: string;
  storefront_image_url: string;
  interior_image_url: string;
  directions: string;
  menu_preview: StoreRequestMenuItem[];
  notices: StoreRequestNotice[];
  status: StoreRequestStatus;
  review_notes?: string;
  reviewed_by_email?: string;
  reviewed_at?: string;
  linked_store_id?: string;
  created_at: string;
  updated_at: string;
}

export type StoreSetupRequest = StoreRequest;

export interface StoreBrandConfig {
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
}

export interface Store {
  id: string;
  store_id?: string;
  name: string;
  slug: string;
  brand_config: StoreBrandConfig;
  owner_name?: string;
  business_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  business_type?: string;
  timezone?: string;
  trial_ends_at?: string;
  logo_url?: string;
  brand_color: string;
  tagline: string;
  description: string;
  public_status: StoreVisibility;
  homepage_visible?: boolean;
  consultation_enabled?: boolean;
  inquiry_enabled?: boolean;
  reservation_enabled?: boolean;
  order_entry_enabled?: boolean;
  subscription_plan: SubscriptionPlan;
  plan?: SubscriptionPlan;
  admin_email: string;
  created_from_request_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreBrandProfile {
  id: string;
  store_id: string;
  brand_name: string;
  logo_url?: string;
  primary_color: string;
  tagline: string;
  description: string;
  updated_at: string;
}

export interface StoreMedia {
  id: string;
  store_id: string;
  type: StoreMediaType;
  title: string;
  image_url: string;
  caption: string;
  sort_order: number;
}

export interface StoreLocation {
  id: string;
  store_id: string;
  address: string;
  directions: string;
  parking_note?: string;
  opening_hours?: string;
  published: boolean;
}

export interface StoreNotice {
  id: string;
  store_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  published_at: string;
}

export interface StoreMember {
  id: string;
  store_id: string;
  profile_id: string;
  role: 'owner' | 'manager' | 'staff';
  created_at: string;
}

export interface StoreFeature {
  id: string;
  store_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
}

export interface StoreTable {
  id: string;
  store_id: string;
  table_no: string;
  seats: number;
  qr_value: string;
  is_active: boolean;
}

export interface MenuCategory {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  store_id: string;
  category_id: string;
  name: string;
  price: number;
  description: string;
  is_popular: boolean;
  is_active: boolean;
}

export interface Customer {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  email?: string;
  visit_count: number;
  last_visit_at?: string;
  is_regular: boolean;
  marketing_opt_in: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  store_id: string;
  customer_id?: string;
  table_id?: string;
  table_no?: string;
  channel: OrderChannel;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  placed_at: string;
  completed_at?: string;
  note?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  store_id: string;
  menu_item_id: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface KitchenTicket {
  id: string;
  store_id: string;
  order_id: string;
  table_id?: string;
  table_no?: string;
  status: Exclude<OrderStatus, 'cancelled'>;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  store_id: string;
  customer_name: string;
  phone: string;
  party_size: number;
  reserved_at: string;
  status: ReservationStatus;
  note?: string;
}

export interface WaitingEntry {
  id: string;
  store_id: string;
  customer_name: string;
  phone: string;
  party_size: number;
  quoted_wait_minutes: number;
  status: WaitingStatus;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  label: string;
  type: 'rating' | 'text';
}

export interface Survey {
  id: string;
  store_id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  created_at: string;
}

export interface SurveyAnswer {
  question_id: string;
  value: string | number;
}

export interface SurveyResponse {
  id: string;
  store_id: string;
  survey_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  answers: SurveyAnswer[];
  created_at: string;
}

export interface StoreSchedule {
  id: string;
  store_id: string;
  title: string;
  type: ScheduleType;
  starts_at: string;
  ends_at: string;
  assignee?: string;
  notes?: string;
}

export interface Contract {
  id: string;
  store_id: string;
  title: string;
  counterparty: string;
  status: ContractStatus;
  file_url?: string;
  metadata: Record<string, string>;
  created_at: string;
}

export interface AIReport {
  id: string;
  store_id: string;
  report_type: ReportType;
  title: string;
  summary: string;
  metrics: Record<string, number | string>;
  generated_at: string;
  source: 'gemini' | 'fallback';
}

export interface BillingEvent {
  id: string;
  store_id: string;
  event_type: 'setup_fee' | 'subscription_charge' | 'payment_failure' | 'refund_request' | 'manual_adjustment';
  title: string;
  amount: number;
  status: BillingEventStatus;
  occurred_at: string;
  note?: string;
}

export interface BillingRecord {
  id: string;
  store_id: string;
  admin_email: string;
  plan: SubscriptionPlan;
  setup_status: SetupPaymentStatus;
  subscription_status: SubscriptionStatus;
  last_payment_at?: string;
  next_billing_at?: string;
  payment_method_status: PaymentMethodStatus;
  updated_at: string;
  events: BillingEvent[];
}

export interface AdminUser {
  id: string;
  profile_id?: string;
  name: string;
  email: string;
  role: AdminUserRole;
  linked_store_ids: string[];
  status: AdminUserStatus;
  invitation_status: InvitationStatus;
  last_sign_in_at?: string;
  created_at: string;
}

export interface SystemStatusItem {
  id: string;
  key: string;
  label: string;
  value: string;
  status: SystemStatusState;
  description: string;
  updated_at: string;
}

export interface StoreProvisioningLog {
  id: string;
  request_id: string;
  store_id?: string;
  action: ProvisioningAction;
  level: ProvisioningLevel;
  message: string;
  created_at: string;
}

export interface SalesDaily {
  id: string;
  store_id: string;
  sale_date: string;
  order_count: number;
  total_sales: number;
  average_order_value: number;
  channel_mix: Partial<Record<OrderChannel, number>>;
}

export type AnalyticsPreset = 'seongsu_brunch_cafe' | 'mapo_evening_restaurant' | 'consultation_service';
export type StorePriorityKey =
  | 'revenue'
  | 'repeatCustomers'
  | 'reservations'
  | 'consultationConversion'
  | 'branding'
  | 'orderEfficiency';

export interface StoreAnalyticsProfile {
  id: string;
  store_id: string;
  industry: string;
  region: string;
  customer_focus: string;
  analytics_preset: AnalyticsPreset;
  updated_at: string;
  version: number;
}

export interface StorePriorityWeights {
  revenue: number;
  repeatCustomers: number;
  reservations: number;
  consultationConversion: number;
  branding: number;
  orderEfficiency: number;
}

export interface StorePrioritySettings {
  id: string;
  store_id: string;
  revenue_weight: number;
  repeat_customer_weight: number;
  reservation_weight: number;
  consultation_weight: number;
  branding_weight: number;
  order_efficiency_weight: number;
  created_at?: string;
  updated_at: string;
  version: number;
}

export interface StoreDailyMetric {
  id: string;
  store_id: string;
  metric_date: string;
  revenue_total: number;
  orders_count: number;
  avg_order_value: number;
  new_customers: number;
  repeat_customers: number;
  repeat_customer_rate: number;
  reservation_count: number;
  no_show_rate: number;
  consultation_count: number;
  consultation_conversion_rate: number;
  review_count: number;
  review_response_rate: number;
  operations_score: number;
  top_signals?: string[];
  version: number;
}

export interface MvpDatabase {
  profiles: Profile[];
  store_requests: StoreRequest[];
  stores: Store[];
  store_analytics_profiles: StoreAnalyticsProfile[];
  store_brand_profiles: StoreBrandProfile[];
  store_media: StoreMedia[];
  store_locations: StoreLocation[];
  store_notices: StoreNotice[];
  store_members: StoreMember[];
  store_features: StoreFeature[];
  store_priority_settings: StorePrioritySettings[];
  store_tables: StoreTable[];
  menu_categories: MenuCategory[];
  menu_items: MenuItem[];
  customers: Customer[];
  orders: Order[];
  order_items: OrderItem[];
  kitchen_tickets: KitchenTicket[];
  reservations: Reservation[];
  waiting_entries: WaitingEntry[];
  surveys: Survey[];
  survey_responses: SurveyResponse[];
  store_schedules: StoreSchedule[];
  contracts: Contract[];
  ai_reports: AIReport[];
  sales_daily: SalesDaily[];
  store_daily_metrics: StoreDailyMetric[];
  billing_records: BillingRecord[];
  admin_users: AdminUser[];
  system_status: SystemStatusItem[];
  store_provisioning_logs: StoreProvisioningLog[];
}

export interface CartItemInput {
  menu_item_id: string;
  quantity: number;
}

export interface SetupRequestInput {
  business_name: string;
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
  requested_slug: string;
  selected_features: FeatureKey[];
}
