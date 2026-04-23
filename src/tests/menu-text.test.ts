import { repairOrderItemMenuName, repairPublicMenuCatalog } from '@/shared/lib/menuText';

describe('menu text repair', () => {
  it('preserves valid menu labels', () => {
    const repaired = repairPublicMenuCatalog({
      categories: [
        {
          id: 'category_1',
          store_id: 'store_1',
          name: '시그니처 메뉴',
          sort_order: 1,
        },
      ],
      items: [
        {
          id: 'item_1',
          store_id: 'store_1',
          category_id: 'category_1',
          name: '딸기 크림 라떼',
          price: 7800,
          description: '계절 한정 메뉴',
          is_popular: true,
          is_active: true,
        },
      ],
    });

    expect(repaired.categories[0]?.name).toBe('시그니처 메뉴');
    expect(repaired.items[0]?.name).toBe('딸기 크림 라떼');
    expect(repaired.items[0]?.description).toBe('계절 한정 메뉴');
  });

  it('replaces question-mark placeholders with deterministic Korean fallback labels', () => {
    const repaired = repairPublicMenuCatalog({
      categories: [
        {
          id: 'category_1',
          store_id: 'store_1',
          name: '???? ???',
          sort_order: 1,
        },
      ],
      items: [
        {
          id: 'item_1',
          store_id: 'store_1',
          category_id: 'category_1',
          name: '?? ?? ???',
          price: 19500,
          description: '?? ??',
          is_popular: true,
          is_active: true,
        },
        {
          id: 'item_2',
          store_id: 'store_1',
          category_id: 'category_1',
          name: '?? ??? ????',
          price: 18000,
          description: '',
          is_popular: false,
          is_active: true,
        },
      ],
    });

    expect(repaired.categories[0]?.name).toBe('대표 메뉴');
    expect(repaired.items[0]?.name).toBe('대표 메뉴 1');
    expect(repaired.items[1]?.name).toBe('대표 메뉴 2');
    expect(repaired.items[0]?.description).toBe('');
  });

  it('repairs corrupted order item labels without changing healthy names', () => {
    expect(
      repairOrderItemMenuName({
        id: 'order_item_1',
        order_id: 'order_1',
        store_id: 'store_1',
        menu_item_id: 'item_1',
        menu_name: '?? ?? ???',
        quantity: 1,
        unit_price: 19500,
        line_total: 19500,
      }).menu_name,
    ).toBe('메뉴');

    expect(
      repairOrderItemMenuName({
        id: 'order_item_2',
        order_id: 'order_1',
        store_id: 'store_1',
        menu_item_id: 'item_2',
        menu_name: '한우 스테이크',
        quantity: 1,
        unit_price: 32000,
        line_total: 32000,
      }).menu_name,
    ).toBe('한우 스테이크');
  });
});
