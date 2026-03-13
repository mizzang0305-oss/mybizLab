import { generateGeminiSummary } from '@/integrations/gemini/gemini';
import { matchOrCreateCustomer } from '@/shared/lib/domain/customers';
import { buildStoreFeatures } from '@/shared/lib/domain/features';
import { buildOrderItems, calculateOrderTotal, upsertSalesDailyForCompletedOrder } from '@/shared/lib/domain/orders';
import { formatCurrency, startOfDayKey, sumBy } from '@/shared/lib/format';
import { createId } from '@/shared/lib/ids';
import { getDatabase, updateDatabase } from '@/shared/lib/mockDb';
import { buildStoreUrl, ensureUniqueStoreSlug, isReservedSlug, normalizeStoreSlug } from '@/shared/lib/storeSlug';
import type {
  AIReport,
  CartItemInput,
  Contract,
  Customer,
  KitchenTicket,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  ReportType,
  Reservation,
  ReservationStatus,
  SetupRequestInput,
  Store,
  StoreSchedule,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  WaitingEntry,
  WaitingStatus,
} from '@/shared/types/models';

const DEMO_PROFILE_ID = 'profile_demo_owner';

function nowIso() {
  return new Date().toISOString();
}

function getStoreMembersStores() {
  const database = getDatabase();
  const memberships = database.store_members.filter((member) => member.profile_id === DEMO_PROFILE_ID);
  const storeIdSet = new Set(memberships.map((member) => member.store_id));
  return database.stores.filter((store) => storeIdSet.has(store.id));
}

function getStoreScopedData(storeId: string) {
  const database = getDatabase();
  return {
    database,
    store: database.stores.find((item) => item.id === storeId),
    features: database.store_features.filter((item) => item.store_id === storeId),
    tables: database.store_tables.filter((item) => item.store_id === storeId),
    menuCategories: database.menu_categories.filter((item) => item.store_id === storeId),
    menuItems: database.menu_items.filter((item) => item.store_id === storeId),
    customers: database.customers.filter((item) => item.store_id === storeId),
    orders: database.orders.filter((item) => item.store_id === storeId),
    orderItems: database.order_items.filter((item) => item.store_id === storeId),
    kitchenTickets: database.kitchen_tickets.filter((item) => item.store_id === storeId),
    reservations: database.reservations.filter((item) => item.store_id === storeId),
    waitingEntries: database.waiting_entries.filter((item) => item.store_id === storeId),
    surveys: database.surveys.filter((item) => item.store_id === storeId),
    surveyResponses: database.survey_responses.filter((item) => item.store_id === storeId),
    schedules: database.store_schedules.filter((item) => item.store_id === storeId),
    contracts: database.contracts.filter((item) => item.store_id === storeId),
    reports: database.ai_reports.filter((item) => item.store_id === storeId),
    sales: database.sales_daily.filter((item) => item.store_id === storeId),
  };
}

function orderItemsForOrder(orderId: string, orderItems: OrderItem[]) {
  return orderItems.filter((item) => item.order_id === orderId);
}

function getTodayOrders(orders: Order[]) {
  const todayKey = startOfDayKey(new Date());
  return orders.filter((order) => startOfDayKey(order.placed_at) === todayKey && order.status !== 'cancelled');
}

function getTodayCompletedOrders(orders: Order[]) {
  const todayKey = startOfDayKey(new Date());
  return orders.filter(
    (order) => order.status === 'completed' && order.completed_at && startOfDayKey(order.completed_at) === todayKey,
  );
}

function buildMenuPerformance(menuItems: MenuItem[], orderItems: OrderItem[]) {
  const quantityByMenu = orderItems.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.menu_item_id] = (accumulator[item.menu_item_id] || 0) + item.quantity;
    return accumulator;
  }, {});

  const ranked = menuItems
    .map((menuItem) => ({
      menuItem,
      quantity: quantityByMenu[menuItem.id] || 0,
    }))
    .sort((left, right) => right.quantity - left.quantity);

  return {
    popular: ranked[0],
    weak: ranked.at(-1),
  };
}

async function generateAiNarrative(storeId: string) {
  const snapshot = getAiManagerSnapshot(storeId);
  const fallback = `${snapshot.store.name}의 오늘 주문 ${snapshot.todayOrders}건, 매출 ${formatCurrency(
    snapshot.todaySales,
  )}입니다. 인기 메뉴는 ${snapshot.popularMenu}이고, 웨이팅 ${snapshot.waitingCount}건과 예약 ${snapshot.reservationCount}건이 연결되어 있어 피크 타임 대응 인력을 미리 배치하는 것이 좋습니다.`;

  const prompt = [
    'You are an operations analyst for a restaurant SaaS product.',
    'Write a concise, practical Korean summary with 3 action-oriented recommendations.',
    `Store: ${snapshot.store.name}`,
    `Today orders: ${snapshot.todayOrders}`,
    `Today sales: ${snapshot.todaySales}`,
    `Popular menu: ${snapshot.popularMenu}`,
    `Weak menu: ${snapshot.weakMenu}`,
    `Regular customer growth: ${snapshot.regularGrowth}`,
    `Reservations today: ${snapshot.reservationCount}`,
    `Waiting now: ${snapshot.waitingCount}`,
  ].join('\n');

  return generateGeminiSummary(prompt, fallback);
}

export async function getCurrentProfile() {
  const database = getDatabase();
  return database.profiles.find((profile) => profile.id === DEMO_PROFILE_ID) || null;
}

export async function listAccessibleStores() {
  return getStoreMembersStores();
}

export async function listSetupRequests() {
  const database = getDatabase();
  return database.store_setup_requests.slice().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function saveSetupRequest(input: SetupRequestInput) {
  const timestamp = nowIso();
  const request = {
    id: createId('setup_request'),
    ...input,
    requested_slug: normalizeStoreSlug(input.requested_slug || input.business_name),
    status: 'submitted' as const,
    created_at: timestamp,
    updated_at: timestamp,
  };

  updateDatabase((database) => {
    database.store_setup_requests.unshift(request);
  });

  return request;
}

export async function createStoreFromSetupRequest(input: SetupRequestInput) {
  const existingStores = await listAccessibleStores();
  const uniqueSlug = ensureUniqueStoreSlug(
    input.requested_slug || input.business_name,
    existingStores.map((store) => store.slug),
  );
  const timestamp = nowIso();
  const storeId = createId('store');
  const store: Store = {
    id: storeId,
    name: input.business_name,
    slug: uniqueSlug,
    owner_name: input.owner_name,
    business_number: input.business_number,
    phone: input.phone,
    email: input.email,
    address: input.address,
    business_type: input.business_type,
    brand_color: '#ec5b13',
    logo_url: '',
    tagline: `${input.business_name}의 운영 효율을 높이는 스토어`,
    description: `${input.business_name} SaaS MVP 스토어`,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const defaultCategories: MenuCategory[] = [
    { id: createId('menu_category'), store_id: storeId, name: '대표 메뉴', sort_order: 1 },
    { id: createId('menu_category'), store_id: storeId, name: '사이드', sort_order: 2 },
  ];

  const defaultMenuItems: MenuItem[] = [
    {
      id: createId('menu_item'),
      store_id: storeId,
      category_id: defaultCategories[0].id,
      name: '시그니처 메뉴',
      price: 12000,
      description: '스토어 생성과 함께 자동 생성된 기본 메뉴',
      is_popular: true,
      is_active: true,
    },
    {
      id: createId('menu_item'),
      store_id: storeId,
      category_id: defaultCategories[1].id,
      name: '추가 옵션',
      price: 3000,
      description: '테이블 오더 테스트용 기본 메뉴',
      is_popular: false,
      is_active: true,
    },
  ];

  const defaultTables = ['A1', 'A2', 'B1'].map((tableNo, index) => ({
    id: createId('store_table'),
    store_id: storeId,
    table_no: tableNo,
    seats: index === 0 ? 2 : 4,
    qr_value: `${buildStoreUrl(uniqueSlug)}/order?table=${tableNo}`,
    is_active: true,
  }));

  updateDatabase((database) => {
    database.stores.unshift(store);
    database.store_members.unshift({
      id: createId('store_member'),
      store_id: storeId,
      profile_id: DEMO_PROFILE_ID,
      role: 'owner',
      created_at: timestamp,
    });
    database.store_features.push(...buildStoreFeatures(storeId, input.selected_features));
    database.menu_categories.push(...defaultCategories);
    database.menu_items.push(...defaultMenuItems);
    database.store_tables.push(...defaultTables);
    database.store_setup_requests.unshift({
      id: createId('setup_request'),
      ...input,
      requested_slug: uniqueSlug,
      status: 'converted',
      created_at: timestamp,
      updated_at: timestamp,
    });
  });

  return {
    store,
    publicUrl: buildStoreUrl(uniqueSlug),
  };
}

export async function getStoreById(storeId: string) {
  const database = getDatabase();
  return database.stores.find((store) => store.id === storeId) || null;
}

export async function getStoreBySlug(storeSlug: string) {
  const database = getDatabase();
  const normalized = normalizeStoreSlug(storeSlug);
  if (isReservedSlug(normalized)) {
    return null;
  }
  return database.stores.find((store) => store.slug === normalized) || null;
}

export function getDashboardSnapshot(storeId: string) {
  const data = getStoreScopedData(storeId);
  const todayOrders = getTodayOrders(data.orders);
  const completedToday = getTodayCompletedOrders(data.orders);
  const totalSales = sumBy(completedToday, (order) => order.total_amount);
  const performance = buildMenuPerformance(data.menuItems, data.orderItems);
  const waitingActive = data.waitingEntries.filter((entry) => entry.status === 'waiting' || entry.status === 'called');
  const reservationsToday = data.reservations.filter((reservation) => startOfDayKey(reservation.reserved_at) === startOfDayKey(new Date()));

  return {
    store: data.store!,
    todayOrders: todayOrders.length,
    todaySales: totalSales,
    activeWaiting: waitingActive.length,
    upcomingReservations: reservationsToday.length,
    popularMenu: performance.popular?.menuItem.name || '-',
    recentOrders: data.orders
      .slice()
      .sort((left, right) => right.placed_at.localeCompare(left.placed_at))
      .slice(0, 5)
      .map((order) => ({
        ...order,
        items: orderItemsForOrder(order.id, data.orderItems),
      })),
    enabledFeatures: data.features.filter((feature) => feature.enabled).length,
  };
}

export function getAiManagerSnapshot(storeId: string) {
  const data = getStoreScopedData(storeId);
  const todayOrders = getTodayOrders(data.orders);
  const completedToday = getTodayCompletedOrders(data.orders);
  const todaySales = sumBy(completedToday, (order) => order.total_amount);
  const performance = buildMenuPerformance(data.menuItems, data.orderItems);
  const regularGrowth = data.customers.filter((customer) => customer.is_regular).length;
  const reservationCount = data.reservations.filter(
    (reservation) => reservation.status === 'booked' || reservation.status === 'seated',
  ).length;
  const waitingCount = data.waitingEntries.filter(
    (entry) => entry.status === 'waiting' || entry.status === 'called',
  ).length;

  return {
    store: data.store!,
    todayOrders: todayOrders.length,
    todaySales,
    popularMenu: performance.popular?.menuItem.name || '-',
    weakMenu: performance.weak?.menuItem.name || '-',
    regularGrowth,
    reservationCount,
    waitingCount,
  };
}

export async function getAiManagerData(storeId: string) {
  const snapshot = getAiManagerSnapshot(storeId);
  const narrative = await generateAiNarrative(storeId);

  return {
    ...snapshot,
    insight: narrative.text,
    insightSource: narrative.source,
    insightError: narrative.error,
  };
}

export async function listAiReports(storeId: string) {
  return getStoreScopedData(storeId).reports.slice().sort((left, right) => right.generated_at.localeCompare(left.generated_at));
}

export async function generateAiReport(storeId: string, reportType: ReportType) {
  const snapshot = getAiManagerSnapshot(storeId);
  const fallback = `${reportType === 'daily' ? '일간' : '주간'} 리포트: ${snapshot.store.name}은 ${
    snapshot.todayOrders
  }건 주문과 ${formatCurrency(snapshot.todaySales)} 매출을 기록했습니다. 인기 메뉴 ${snapshot.popularMenu}, 부진 메뉴 ${
    snapshot.weakMenu
  }, 현재 예약 ${snapshot.reservationCount}건, 웨이팅 ${snapshot.waitingCount}건을 기준으로 피크 타임 대비와 메뉴 개선 액션이 필요합니다.`;

  const prompt = [
    'Create a Korean store operations report for an SMB SaaS dashboard.',
    `Report type: ${reportType}`,
    `Store name: ${snapshot.store.name}`,
    `Today orders: ${snapshot.todayOrders}`,
    `Today sales: ${snapshot.todaySales}`,
    `Popular menu: ${snapshot.popularMenu}`,
    `Weak menu: ${snapshot.weakMenu}`,
    `Reservations: ${snapshot.reservationCount}`,
    `Waiting: ${snapshot.waitingCount}`,
    'Return a concise markdown-ready summary.',
  ].join('\n');

  const aiResult = await generateGeminiSummary(prompt, fallback);
  const report: AIReport = {
    id: createId('ai_report'),
    store_id: storeId,
    report_type: reportType,
    title: reportType === 'daily' ? '일간 비즈니스 리포트' : '주간 비즈니스 리포트',
    summary: aiResult.text,
    metrics: {
      todayOrders: snapshot.todayOrders,
      todaySales: snapshot.todaySales,
      popularMenu: snapshot.popularMenu,
      weakMenu: snapshot.weakMenu,
    },
    generated_at: nowIso(),
    source: aiResult.source,
  };

  updateDatabase((database) => {
    database.ai_reports.unshift(report);
  });

  return report;
}

export async function listCustomers(storeId: string) {
  return getStoreScopedData(storeId).customers
    .slice()
    .sort((left, right) => (right.last_visit_at || '').localeCompare(left.last_visit_at || ''));
}

export async function upsertCustomer(
  storeId: string,
  customerInput: Pick<Customer, 'name' | 'phone' | 'email' | 'marketing_opt_in'> & { id?: string },
) {
  const timestamp = nowIso();
  let nextCustomer: Customer | null = null;

  updateDatabase((database) => {
    if (customerInput.id) {
      database.customers = database.customers.map((customer) => {
        if (customer.id !== customerInput.id) {
          return customer;
        }

        nextCustomer = {
          ...customer,
          ...customerInput,
        };

        return nextCustomer!;
      });
      return;
    }

    nextCustomer = {
      id: createId('customer'),
      store_id: storeId,
      name: customerInput.name,
      phone: customerInput.phone,
      email: customerInput.email,
      marketing_opt_in: customerInput.marketing_opt_in,
      visit_count: 0,
      is_regular: false,
      created_at: timestamp,
    };

    database.customers.unshift(nextCustomer);
  });

  return nextCustomer;
}

export async function attachCustomerToOrder(
  storeId: string,
  orderId: string,
  input: { phone: string; name?: string; email?: string; marketingOptIn?: boolean },
) {
  let matchedCustomer: Customer | null = null;

  updateDatabase((database) => {
    const result = matchOrCreateCustomer(database.customers, {
      storeId,
      phone: input.phone,
      name: input.name,
      email: input.email,
      marketingOptIn: input.marketingOptIn,
      visitedAt: nowIso(),
    });

    database.customers = result.customers;
    matchedCustomer = result.customer;
    database.orders = database.orders.map((order) =>
      order.id === orderId ? { ...order, customer_id: result.customer.id } : order,
    );
  });

  return matchedCustomer;
}

export async function listReservations(storeId: string) {
  return getStoreScopedData(storeId).reservations
    .slice()
    .sort((left, right) => left.reserved_at.localeCompare(right.reserved_at));
}

export async function saveReservation(
  storeId: string,
  input: Omit<Reservation, 'id' | 'store_id'> & { id?: string },
) {
  const reservation: Reservation = {
    ...input,
    id: input.id || createId('reservation'),
    store_id: storeId,
  };

  updateDatabase((database) => {
    const existingIndex = database.reservations.findIndex((item) => item.id === reservation.id);
    if (existingIndex >= 0) {
      database.reservations[existingIndex] = reservation;
    } else {
      database.reservations.unshift(reservation);
    }
  });

  return reservation;
}

export async function updateReservationStatus(storeId: string, reservationId: string, status: ReservationStatus) {
  return saveReservation(storeId, {
    ...(getStoreScopedData(storeId).reservations.find((reservation) => reservation.id === reservationId) as Reservation),
    status,
  });
}

export async function listSchedules(storeId: string) {
  return getStoreScopedData(storeId).schedules.slice().sort((left, right) => left.starts_at.localeCompare(right.starts_at));
}

export async function saveSchedule(storeId: string, input: Omit<StoreSchedule, 'id' | 'store_id'> & { id?: string }) {
  const schedule: StoreSchedule = {
    ...input,
    id: input.id || createId('schedule'),
    store_id: storeId,
  };

  updateDatabase((database) => {
    const existingIndex = database.store_schedules.findIndex((item) => item.id === schedule.id);
    if (existingIndex >= 0) {
      database.store_schedules[existingIndex] = schedule;
    } else {
      database.store_schedules.unshift(schedule);
    }
  });

  return schedule;
}

export async function listSurveys(storeId: string) {
  const data = getStoreScopedData(storeId);
  return data.surveys.map((survey) => ({
    ...survey,
    responses: data.surveyResponses.filter((response) => response.survey_id === survey.id),
  }));
}

export async function saveSurvey(
  storeId: string,
  input: { id?: string; title: string; description: string; questions: SurveyQuestion[]; is_active: boolean },
) {
  const survey: Survey = {
    ...input,
    id: input.id || createId('survey'),
    store_id: storeId,
    created_at: input.id ? getStoreScopedData(storeId).surveys.find((item) => item.id === input.id)?.created_at || nowIso() : nowIso(),
  };

  updateDatabase((database) => {
    const existingIndex = database.surveys.findIndex((item) => item.id === survey.id);
    if (existingIndex >= 0) {
      database.surveys[existingIndex] = survey;
    } else {
      database.surveys.unshift(survey);
    }
  });

  return survey;
}

export async function saveSurveyResponse(
  storeId: string,
  input: Omit<SurveyResponse, 'id' | 'store_id' | 'created_at'>,
) {
  const response: SurveyResponse = {
    ...input,
    id: createId('survey_response'),
    store_id: storeId,
    created_at: nowIso(),
  };

  updateDatabase((database) => {
    database.survey_responses.unshift(response);
  });

  return response;
}

export async function getBrandProfile(storeId: string) {
  return getStoreScopedData(storeId).store;
}

export async function updateBrandProfile(
  storeId: string,
  input: Pick<Store, 'logo_url' | 'brand_color' | 'tagline' | 'description'>,
) {
  let nextStore: Store | null = null;

  updateDatabase((database) => {
    database.stores = database.stores.map((store) => {
      if (store.id !== storeId) {
        return store;
      }

      nextStore = {
        ...store,
        ...input,
        updated_at: nowIso(),
      };

      return nextStore!;
    });
  });

  return nextStore;
}

export async function listSales(storeId: string) {
  const data = getStoreScopedData(storeId);
  const sales = data.sales.slice().sort((left, right) => left.sale_date.localeCompare(right.sale_date));
  const completedOrders = data.orders.filter((order) => order.status === 'completed');
  const totalSales = sumBy(completedOrders, (order) => order.total_amount);
  const channelMix = completedOrders.reduce<Record<string, number>>((accumulator, order) => {
    accumulator[order.channel] = (accumulator[order.channel] || 0) + 1;
    return accumulator;
  }, {});

  return {
    sales,
    totals: {
      totalSales,
      orderCount: completedOrders.length,
      averageOrderValue: completedOrders.length ? Math.round(totalSales / completedOrders.length) : 0,
      channelMix,
    },
  };
}

export async function listOrders(storeId: string) {
  const data = getStoreScopedData(storeId);
  return data.orders
    .slice()
    .sort((left, right) => right.placed_at.localeCompare(left.placed_at))
    .map((order) => ({
      ...order,
      items: orderItemsForOrder(order.id, data.orderItems),
      customer: data.customers.find((customer) => customer.id === order.customer_id),
    }));
}

function completeOrder(database: ReturnType<typeof getDatabase>, order: Order) {
  if (order.status === 'completed' && order.completed_at) {
    return order;
  }

  const completedOrder: Order = {
    ...order,
    status: 'completed',
    completed_at: nowIso(),
  };

  database.sales_daily = upsertSalesDailyForCompletedOrder(database.sales_daily, {
    store_id: completedOrder.store_id,
    placed_at: completedOrder.completed_at,
    total_amount: completedOrder.total_amount,
    channel: completedOrder.channel,
  });

  return completedOrder;
}

export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatus) {
  let updatedOrder: Order | null = null;

  updateDatabase((database) => {
    database.orders = database.orders.map((order) => {
      if (order.id !== orderId || order.store_id !== storeId) {
        return order;
      }

      updatedOrder =
        status === 'completed'
          ? completeOrder(database, order)
          : {
              ...order,
              status,
            };

      return updatedOrder!;
    });

    database.kitchen_tickets = database.kitchen_tickets.map((ticket) => {
      if (ticket.order_id !== orderId || ticket.store_id !== storeId || status === 'cancelled') {
        return ticket;
      }

      return {
        ...ticket,
        status: status === 'completed' ? 'completed' : status,
        updated_at: nowIso(),
      };
    });
  });

  return updatedOrder;
}

export async function listKitchenTickets(storeId: string) {
  const data = getStoreScopedData(storeId);
  return data.kitchenTickets
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((ticket) => ({
      ...ticket,
      order: data.orders.find((order) => order.id === ticket.order_id),
      items: orderItemsForOrder(ticket.order_id, data.orderItems),
    }));
}

export async function updateKitchenTicketStatus(storeId: string, ticketId: string, status: KitchenTicket['status']) {
  let targetOrderId = '';

  updateDatabase((database) => {
    database.kitchen_tickets = database.kitchen_tickets.map((ticket) => {
      if (ticket.id !== ticketId || ticket.store_id !== storeId) {
        return ticket;
      }

      targetOrderId = ticket.order_id;

      return {
        ...ticket,
        status,
        updated_at: nowIso(),
      };
    });
  });

  if (targetOrderId) {
    await updateOrderStatus(storeId, targetOrderId, status === 'completed' ? 'completed' : status);
  }
}

export async function listWaitingEntries(storeId: string) {
  return getStoreScopedData(storeId).waitingEntries
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function saveWaitingEntry(
  storeId: string,
  input: Omit<WaitingEntry, 'id' | 'store_id' | 'created_at'> & { id?: string; created_at?: string },
) {
  const waitingEntry: WaitingEntry = {
    ...input,
    id: input.id || createId('waiting'),
    store_id: storeId,
    created_at: input.created_at || nowIso(),
  };

  updateDatabase((database) => {
    const existingIndex = database.waiting_entries.findIndex((item) => item.id === waitingEntry.id);
    if (existingIndex >= 0) {
      database.waiting_entries[existingIndex] = waitingEntry;
    } else {
      database.waiting_entries.unshift(waitingEntry);
    }
  });

  return waitingEntry;
}

export async function updateWaitingStatus(storeId: string, waitingId: string, status: WaitingStatus) {
  return saveWaitingEntry(storeId, {
    ...(getStoreScopedData(storeId).waitingEntries.find((entry) => entry.id === waitingId) as WaitingEntry),
    status,
  });
}

export async function listContracts(storeId: string) {
  return getStoreScopedData(storeId).contracts.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function saveContract(
  storeId: string,
  input: Omit<Contract, 'id' | 'store_id' | 'created_at'> & { id?: string },
) {
  const contract: Contract = {
    ...input,
    id: input.id || createId('contract'),
    store_id: storeId,
    created_at: input.id ? getStoreScopedData(storeId).contracts.find((item) => item.id === input.id)?.created_at || nowIso() : nowIso(),
  };

  updateDatabase((database) => {
    const existingIndex = database.contracts.findIndex((item) => item.id === contract.id);
    if (existingIndex >= 0) {
      database.contracts[existingIndex] = contract;
    } else {
      database.contracts.unshift(contract);
    }
  });

  return contract;
}

export async function listStoreTables(storeId: string) {
  return getStoreScopedData(storeId).tables;
}

export async function createStoreTable(storeId: string, input: { table_no: string; seats: number }) {
  const store = await getStoreById(storeId);
  if (!store) {
    throw new Error('Store not found');
  }

  const table = {
    id: createId('store_table'),
    store_id: storeId,
    table_no: input.table_no,
    seats: input.seats,
    qr_value: `${buildStoreUrl(store.slug)}/order?table=${encodeURIComponent(input.table_no)}`,
    is_active: true,
  };

  updateDatabase((database) => {
    database.store_tables.unshift(table);
  });

  return table;
}

export async function listMenu(storeId: string) {
  const data = getStoreScopedData(storeId);
  return {
    categories: data.menuCategories.slice().sort((left, right) => left.sort_order - right.sort_order),
    items: data.menuItems.filter((item) => item.is_active),
  };
}

export async function createMenuCategory(storeId: string, name: string) {
  const data = getStoreScopedData(storeId);
  const category: MenuCategory = {
    id: createId('menu_category'),
    store_id: storeId,
    name,
    sort_order: data.menuCategories.length + 1,
  };

  updateDatabase((database) => {
    database.menu_categories.push(category);
  });

  return category;
}

export async function createMenuItem(
  storeId: string,
  input: Pick<MenuItem, 'category_id' | 'name' | 'price' | 'description' | 'is_popular'>,
) {
  const item: MenuItem = {
    id: createId('menu_item'),
    store_id: storeId,
    is_active: true,
    ...input,
  };

  updateDatabase((database) => {
    database.menu_items.unshift(item);
  });

  return item;
}

export async function getPublicStore(storeSlug: string) {
  const store = await getStoreBySlug(storeSlug);
  if (!store) {
    return null;
  }

  const menu = await listMenu(store.id);
  const tables = await listStoreTables(store.id);

  return {
    store,
    menu,
    tables,
  };
}

export async function submitPublicOrder(input: {
  storeSlug: string;
  tableNo?: string;
  items: CartItemInput[];
  note?: string;
}) {
  const store = await getStoreBySlug(input.storeSlug);

  if (!store) {
    throw new Error('Store not found');
  }

  const scoped = getStoreScopedData(store.id);
  const table = input.tableNo
    ? scoped.tables.find((item) => item.table_no.toLowerCase() === input.tableNo?.toLowerCase())
    : undefined;

  const lineItems = input.items
    .map((item) => {
      const menuItem = scoped.menuItems.find((menu) => menu.id === item.menu_item_id);
      if (!menuItem) {
        return null;
      }

      return {
        menuItemId: menuItem.id,
        menuName: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
      };
    })
    .filter(Boolean) as Array<{ menuItemId: string; menuName: string; quantity: number; unitPrice: number }>;

  const orderId = createId('order');
  const order: Order = {
    id: orderId,
    store_id: store.id,
    table_id: table?.id,
    table_no: table?.table_no,
    channel: table ? 'table' : 'walk_in',
    status: 'pending',
    total_amount: calculateOrderTotal(lineItems),
    placed_at: nowIso(),
    note: input.note,
  };

  const items = buildOrderItems(orderId, store.id, lineItems);
  const ticket: KitchenTicket = {
    id: createId('kitchen_ticket'),
    store_id: store.id,
    order_id: orderId,
    table_id: table?.id,
    table_no: table?.table_no,
    status: 'pending',
    created_at: order.placed_at,
    updated_at: order.placed_at,
  };

  updateDatabase((database) => {
    database.orders.unshift(order);
    database.order_items.push(...items);
    database.kitchen_tickets.unshift(ticket);
  });

  return {
    order,
    items,
    ticket,
  };
}
