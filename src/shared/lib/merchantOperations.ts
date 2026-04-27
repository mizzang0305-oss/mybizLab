import type {
  OrderChannel,
  OrderPaymentMethod,
  OrderPaymentSource,
  OrderStatus,
  PaymentStatus,
  InquiryStatus,
  ReservationStatus,
  WaitingStatus,
} from '../types/models';

export interface MerchantNextAction<TStatus extends string = string> {
  description: string;
  label: string;
  nextStatus?: TStatus;
}

export interface OrderActionState {
  payment_status: PaymentStatus;
  status: OrderStatus;
}

const merchantStatusLabelMap: Record<string, string> = {
  unknown: '고객 정보 없음',
  pending: '결제 대기',
  completed: '결제 완료',
  failed: '처리 실패',
  paid: '결제 완료',
  refunded: '환불 완료',
  requested: '요청됨',
  accepted: '접수 완료',
  preparing: '준비 중',
  ready: '준비 완료',
  cancelled: '취소',
  booked: '예약 확정',
  seated: '착석',
  no_show: '노쇼',
  waiting: '대기 중',
  called: '호출 완료',
  new: '신규',
  in_progress: '응대 중',
  on_hold: '보류',
  open: '열림',
  closed: '종료',
  public: '공개',
  private: '비공개',
  active: '사용 중',
  inactive: '중지',
  warning: '확인 필요',
  error: '오류',
};

const orderStatusLabelMap: Record<OrderStatus, string> = {
  pending: '접수 대기',
  accepted: '접수 완료',
  preparing: '준비 중',
  ready: '준비 완료',
  completed: '주문 완료',
  cancelled: '주문 취소',
};

const paymentStatusLabelMap: Record<PaymentStatus, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  refunded: '환불 완료',
};

const inquiryStatusLabelMap: Record<InquiryStatus, string> = {
  new: '신규 문의',
  in_progress: '응대 중',
  completed: '처리 완료',
  on_hold: '보류',
};

const reservationStatusLabelMap: Record<ReservationStatus, string> = {
  booked: '예약 확정',
  seated: '착석',
  completed: '방문 완료',
  cancelled: '예약 취소',
  no_show: '노쇼',
};

const waitingStatusLabelMap: Record<WaitingStatus, string> = {
  waiting: '대기 중',
  called: '호출 완료',
  seated: '입장 완료',
  cancelled: '대기 취소',
};

const orderChannelLabelMap: Record<OrderChannel | 'pickup' | 'table_order', string> = {
  delivery: '배달',
  pickup: '포장',
  reservation: '예약 주문',
  table: '테이블 주문',
  table_order: '테이블 주문',
  walk_in: '매장 방문',
};

const paymentSourceLabelMap: Record<OrderPaymentSource, string> = {
  counter: '카운터 결제',
  mobile: '모바일 결제',
};

const paymentMethodLabelMap: Record<OrderPaymentMethod, string> = {
  card: '카드',
  cash: '현금',
  other: '기타',
};

export function normalizeMerchantStatus(status: string) {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function getMerchantStatusLabel(status: string) {
  const normalizedStatus = normalizeMerchantStatus(status);

  return merchantStatusLabelMap[normalizedStatus] || '상태 확인 필요';
}

export function getOrderStatusLabel(status: OrderStatus) {
  return orderStatusLabelMap[status];
}

export function getPaymentStatusLabel(status: PaymentStatus) {
  return paymentStatusLabelMap[status];
}

export function getInquiryStatusLabel(status: InquiryStatus) {
  return inquiryStatusLabelMap[status];
}

export function getReservationStatusLabel(status: ReservationStatus) {
  return reservationStatusLabelMap[status];
}

export function getWaitingStatusLabel(status: WaitingStatus) {
  return waitingStatusLabelMap[status];
}

export function getOrderChannelLabel(channel: string) {
  return orderChannelLabelMap[channel as keyof typeof orderChannelLabelMap] || '주문 채널 확인 필요';
}

export function getPaymentSourceLabel(source?: OrderPaymentSource | string) {
  return source ? paymentSourceLabelMap[source as OrderPaymentSource] || '결제 방식 확인 필요' : '결제 방식 미확인';
}

export function getPaymentMethodLabel(method?: OrderPaymentMethod | string) {
  return method ? paymentMethodLabelMap[method as OrderPaymentMethod] || '결제 수단 확인 필요' : '';
}

export function getOrderNextAction(order: OrderActionState): MerchantNextAction<OrderStatus> {
  if (order.status === 'pending') {
    return {
      description: '새 주문입니다. 먼저 접수 여부를 확정하세요.',
      label: '주문 접수',
      nextStatus: 'accepted',
    };
  }

  if (order.status === 'accepted') {
    return {
      description: '접수된 주문입니다. 주방 또는 준비 담당자가 바로 시작하면 됩니다.',
      label: '준비 시작',
      nextStatus: 'preparing',
    };
  }

  if (order.status === 'preparing') {
    return {
      description: '준비 중인 주문입니다. 제공 준비가 끝나면 상태를 넘기세요.',
      label: '준비 완료',
      nextStatus: 'ready',
    };
  }

  if (order.status === 'ready' && order.payment_status === 'paid') {
    return {
      description: '결제까지 끝난 주문입니다. 고객에게 제공 후 완료 처리하세요.',
      label: '주문 완료 처리',
      nextStatus: 'completed',
    };
  }

  if (order.status === 'ready') {
    return {
      description: '제공 준비는 끝났지만 결제 확인이 아직 남았습니다.',
      label: '결제 확인 필요',
    };
  }

  if (order.status === 'completed') {
    return {
      description: '이미 완료된 주문입니다.',
      label: '처리 완료',
    };
  }

  return {
    description: '취소된 주문입니다. 추가 처리가 필요하면 새 주문으로 다시 접수하세요.',
    label: '취소됨',
  };
}

export function getReservationNextAction(status: ReservationStatus): MerchantNextAction<ReservationStatus> | null {
  if (status === 'booked') {
    return {
      description: '예약자가 도착하면 바로 착석 처리하세요.',
      label: '착석 처리',
      nextStatus: 'seated',
    };
  }

  if (status === 'seated') {
    return {
      description: '방문 응대가 끝나면 방문 완료로 정리하세요.',
      label: '방문 완료',
      nextStatus: 'completed',
    };
  }

  return null;
}

export function getWaitingNextAction(status: WaitingStatus): MerchantNextAction<WaitingStatus> | null {
  if (status === 'waiting') {
    return {
      description: '입장 가능한 순서가 되면 고객을 호출하세요.',
      label: '고객 호출',
      nextStatus: 'called',
    };
  }

  if (status === 'called') {
    return {
      description: '고객이 입장하면 웨이팅을 완료하세요.',
      label: '입장 완료',
      nextStatus: 'seated',
    };
  }

  return null;
}
