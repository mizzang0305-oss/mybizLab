import { describe, expect, it } from 'vitest';

import { isCorruptedMenuLabel, repairOrderItemMenuName, repairPublicMenuCatalog } from '@/shared/lib/menuText';

describe('menu text hardening', () => {
  it('detects mojibake menu labels and preserves healthy Korean labels', () => {
    expect(isCorruptedMenuLabel('결제 테스트 상품 100원')).toBe(false);
    expect(isCorruptedMenuLabel('寃곗젣 ?뚯뒪???곹뭹 100??')).toBe(true);
  });

  it('falls back corrupted public menu labels without touching healthy labels', () => {
    const repaired = repairPublicMenuCatalog({
      categories: [
        {
          id: 'cat_1',
          name: '怨좉컼 ?ㅼ젙',
          sort_order: 1,
          store_id: 'store_1',
        },
      ],
      items: [
        {
          category_id: 'cat_1',
          description: '???',
          id: 'item_1',
          is_active: true,
          is_popular: false,
          name: '寃곗젣 ?뚯뒪???곹뭹 100??',
          price: 100,
          store_id: 'store_1',
        },
      ],
    });

    expect(repaired.categories[0].name).toBe('대표 메뉴');
    expect(repaired.items[0].name).toBe('대표 메뉴');
    expect(repaired.items[0].description).toBe('');
  });

  it('repairs corrupted order item menu names', () => {
    expect(
      repairOrderItemMenuName({
        id: 'item_1',
        line_total: 100,
        menu_item_id: 'menu_1',
        menu_name: '寃곗젣 ?뚯뒪???곹뭹 100??',
        order_id: 'order_1',
        quantity: 1,
        store_id: 'store_1',
        unit_price: 100,
      }).menu_name,
    ).toBe('메뉴');
  });
});
