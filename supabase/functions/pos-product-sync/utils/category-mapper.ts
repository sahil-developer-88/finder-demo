/**
 * Category Mapper Utility
 * Maps POS product categories to our product_categories table
 * Detects restricted products (alcohol, tobacco, lottery, etc.)
 */

interface CategoryMapping {
  categoryId: string | null;
  isRestricted: boolean;
  matchedCategory: string | null;
}

// Keywords that indicate restricted products
const RESTRICTED_KEYWORDS = {
  alcohol: ['alcohol', 'beer', 'wine', 'liquor', 'spirits', 'vodka', 'whiskey', 'rum', 'tequila', 'champagne', 'cocktail', 'alcoholic'],
  tobacco: ['tobacco', 'cigarette', 'cigar', 'vape', 'vaping', 'e-cig', 'nicotine', 'smoking'],
  lottery: ['lottery', 'scratch', 'powerball', 'mega millions', 'lotto', 'raffle'],
  gift_cards: ['gift card', 'giftcard', 'prepaid card', 'store credit'],
  pharmacy: ['prescription', 'rx', 'medication', 'drug', 'pharmaceutical', 'controlled substance'],
  firearms: ['firearm', 'gun', 'ammunition', 'ammo', 'weapon', 'rifle', 'pistol']
};

/**
 * Get product category ID from our database by name or slug
 */
export async function getProductCategoryId(
  categoryName: string,
  supabase: any
): Promise<string | null> {
  if (!categoryName) return null;

  const normalizedName = categoryName.toLowerCase().trim();

  // Try exact match first
  const { data, error } = await supabase
    .from('product_categories')
    .select('id')
    .or(`name.ilike.${normalizedName},slug.eq.${normalizedName}`)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Detect if a product is restricted based on name, description, or category
 */
export function detectRestrictedProduct(
  productName: string,
  productDescription?: string,
  categoryName?: string
): { isRestricted: boolean; reason: string | null; suggestedCategory: string | null } {
  const searchText = [
    productName,
    productDescription,
    categoryName
  ].filter(Boolean).join(' ').toLowerCase();

  // Check each restricted category
  for (const [category, keywords] of Object.entries(RESTRICTED_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return {
          isRestricted: true,
          reason: `Contains restricted keyword: "${keyword}"`,
          suggestedCategory: category.replace('_', '-')
        };
      }
    }
  }

  return {
    isRestricted: false,
    reason: null,
    suggestedCategory: null
  };
}

/**
 * Map a POS category to our product category system
 */
export async function mapCategory(
  categoryName: string | null | undefined,
  productName: string,
  productDescription: string | null,
  supabase: any
): Promise<CategoryMapping> {
  // First check if product is restricted
  const restrictedCheck = detectRestrictedProduct(
    productName,
    productDescription || undefined,
    categoryName || undefined
  );

  let categoryId: string | null = null;
  let matchedCategory: string | null = null;

  // If restricted, get the restricted category ID
  if (restrictedCheck.isRestricted && restrictedCheck.suggestedCategory) {
    categoryId = await getProductCategoryId(restrictedCheck.suggestedCategory, supabase);
    matchedCategory = restrictedCheck.suggestedCategory;
  }
  // Otherwise try to match the POS category
  else if (categoryName) {
    categoryId = await getProductCategoryId(categoryName, supabase);
    matchedCategory = categoryName;
  }

  // If no match, default to "other" category
  if (!categoryId) {
    categoryId = await getProductCategoryId('other', supabase);
    matchedCategory = 'other';
  }

  return {
    categoryId,
    isRestricted: restrictedCheck.isRestricted,
    matchedCategory
  };
}

/**
 * Batch map categories for multiple products
 */
export async function batchMapCategories(
  products: Array<{
    name: string;
    description?: string | null;
    category?: string | null;
  }>,
  supabase: any
): Promise<Map<string, CategoryMapping>> {
  const mappings = new Map<string, CategoryMapping>();

  for (const product of products) {
    const key = `${product.category || ''}_${product.name}`;
    const mapping = await mapCategory(
      product.category,
      product.name,
      product.description || null,
      supabase
    );
    mappings.set(key, mapping);
  }

  return mappings;
}
