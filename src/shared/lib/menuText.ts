import type { MenuCategory, MenuItem, OrderItem } from '../types/models.js';
import { countPlaceholderCharacters, hasLikelyMojibake } from './brokenText.js';

function normalizeText(value: string) {
  return value.trim();
}

export function isCorruptedMenuLabel(value: string | undefined | null) {
  const normalized = typeof value === 'string' ? normalizeText(value) : '';
  if (!normalized) {
    return true;
  }

  const compact = normalized.replace(/\s+/g, '');
  const placeholderCount = countPlaceholderCharacters(compact);

  if (hasLikelyMojibake(normalized)) {
    return true;
  }

  if (placeholderCount === 0) {
    return false;
  }

  return placeholderCount >= Math.max(2, Math.ceil(compact.length / 2));
}

function buildCategoryFallback(index: number, total: number) {
  return total <= 1 ? '대표 메뉴' : `메뉴 ${index + 1}`;
}

function buildItemFallback(categoryName: string, index: number, total: number) {
  if (total <= 1) {
    return categoryName;
  }

  return `${categoryName} ${index + 1}`;
}

export function repairPublicMenuCatalog(input: {
  categories: MenuCategory[];
  items: MenuItem[];
}) {
  const categories = input.categories.map((category, index, allCategories) => {
    const name = isCorruptedMenuLabel(category.name)
      ? buildCategoryFallback(index, allCategories.length)
      : normalizeText(category.name);

    return {
      ...category,
      name,
    };
  });

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const groupSizeByCategoryId = input.items.reduce<Map<string, number>>((map, item) => {
    map.set(item.category_id, (map.get(item.category_id) || 0) + 1);
    return map;
  }, new Map());
  const seenByCategoryId = new Map<string, number>();

  const items = input.items.map((item) => {
    const categoryIndex = seenByCategoryId.get(item.category_id) || 0;
    seenByCategoryId.set(item.category_id, categoryIndex + 1);

    const categoryName = categoryNameById.get(item.category_id) || '메뉴';
    const displayName = isCorruptedMenuLabel(item.name)
      ? buildItemFallback(categoryName, categoryIndex, groupSizeByCategoryId.get(item.category_id) || 1)
      : normalizeText(item.name);
    const description = isCorruptedMenuLabel(item.description) ? '' : normalizeText(item.description);

    return {
      ...item,
      description,
      name: displayName,
    };
  });

  return {
    categories,
    items,
  };
}

export function repairOrderItemMenuName(
  item: OrderItem,
  options?: {
    fallbackName?: string;
  },
) {
  if (!isCorruptedMenuLabel(item.menu_name)) {
    return item;
  }

  return {
    ...item,
    menu_name: options?.fallbackName?.trim() || '메뉴',
  };
}
