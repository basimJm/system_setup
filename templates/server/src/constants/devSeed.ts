/** Development data of `seed:dev` (never production). Phones use a reserved, undialable range. */
export const DEV_SEED = {
  customer: { name: 'Demo Customer', phone: '+15550100001', language: 'en' },
  merchant: {
    businessName: 'Demo Merchant',
    name: 'Demo Owner',
    phone: '+15550100002',
    language: 'en',
  },
  items: [
    { title: 'First item', description: 'A sample record of the items feature.', tags: ['sample'] },
    { title: 'Second item', description: 'Another sample record.', tags: ['sample', 'demo'] },
    { title: 'Third item', description: 'Archived items stay readable.', tags: ['demo'] },
  ],
} as const;
