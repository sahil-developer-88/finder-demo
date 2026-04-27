import { supabase } from '@/integrations/supabase/client';

function getCategoryImage(category: string): string {
  const lower = (category ?? '').toLowerCase();
  const entries: [string, string][] = [
    ['restaurant', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=300&fit=crop&q=80'],
    ['cafe',       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=300&fit=crop&q=80'],
    ['grocery',    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&h=300&fit=crop&q=80'],
    ['retail',     'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=300&fit=crop&q=80'],
    ['beauty',     'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=300&fit=crop&q=80'],
    ['mechanic',   'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&h=300&fit=crop&q=80'],
    ['handyman',   'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=300&fit=crop&q=80'],
    ['health',     'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=300&fit=crop&q=80'],
    ['fitness',    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=300&fit=crop&q=80'],
    ['lawyer',     'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=300&fit=crop&q=80'],
    ['tutor',      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&h=300&fit=crop&q=80'],
    ['photo',      'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=600&h=300&fit=crop&q=80'],
    ['design',     'https://images.unsplash.com/photo-1561736778-92e52a7769ef?w=600&h=300&fit=crop&q=80'],
    ['consult',    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=300&fit=crop&q=80'],
  ];
  for (const [key, url] of entries) {
    if (lower.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=300&fit=crop&q=80';
}

export function transformBusiness(b: any, businessType = 'product') {
  return {
    id: b.id,
    businessName: b.business_name,
    category: b.category,
    servicesOffered: b.services_offered || [],
    businessType,
    location: b.location || '',
    contactMethod: b.contact_method || '',
    rating: 4.5,
    reviews: Math.floor(Math.random() * 500) + 50,
    verified: false,
    description: b.description || '',
    barterPercentage: Number(b.barter_percentage) || 20,
    image: getCategoryImage(b.category),
  };
}

export async function enrichBusinessType(rows: any[]): Promise<any[]> {
  if (!rows.length) return [];
  const userIds = rows.map(r => r.user_id).filter(Boolean);
  if (!userIds.length) return rows.map(r => transformBusiness(r));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, business_type')
    .in('user_id', userIds);
  const typeMap: Record<string, string> = {};
  (profiles || []).forEach(p => { typeMap[p.user_id] = p.business_type || 'product'; });
  return rows.map(r => transformBusiness(r, typeMap[r.user_id] || 'product'));
}
