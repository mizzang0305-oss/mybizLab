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

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export interface StoreSetupRequest {
  id: string;
  business_name: string;
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
  requested_slug: string;
  selected_features: FeatureKey[];
  status: 'draft' | 'submitted' | 'converted';
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  business_number: string;
  phone: string;
  email: string;
  address: string;
  business_type: string;
  logo_url?: string;
  brand_color: string;
  tagline: string;
  description: string;
  created_at: string;
  updated_at: string;
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

export interface SalesDaily {
  id: string;
  store_id: string;
  sale_date: string;
  order_count: number;
  total_sales: number;
  average_order_value: number;
  channel_mix: Partial<Record<OrderChannel, number>>;
}

export interface MvpDatabase {
  profiles: Profile[];
  store_setup_requests: StoreSetupRequest[];
  stores: Store[];
  store_members: StoreMember[];
  store_features: StoreFeature[];
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
