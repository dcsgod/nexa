/**
 * Seeded retail Lakehouse used by the mock adapter. Deliberately shaped to
 * exercise the whole pipeline: PK/FK relationships, lineage, incompatible
 * grain (sales vs inventory), synonyms, and metric ambiguity.
 */
import type {
  LineageEdge,
  ProfileStats,
  QueryUsageSignal,
  UcTable,
} from '../types.js';

const now = '2026-09-10T00:00:00Z';

export const MOCK_TABLES: UcTable[] = [
  {
    catalog: 'retail',
    schema: 'sales',
    name: 'fact_sales',
    table_type: 'MANAGED',
    comment: 'Sales transactions at line-item grain.',
    owner: 'data_eng',
    tags: ['certified', 'finance'],
    updated_at: now,
    columns: [
      { name: 'sales_id', data_type: 'bigint', nullable: false, is_primary_key: true, comment: 'Transaction line id' },
      { name: 'store_id', data_type: 'int', nullable: false, comment: 'Selling store', foreign_key: { table: 'retail.sales.dim_store', column: 'store_id' } },
      { name: 'product_id', data_type: 'int', nullable: false, foreign_key: { table: 'retail.sales.dim_product', column: 'product_id' } },
      { name: 'date_id', data_type: 'int', nullable: false, foreign_key: { table: 'retail.sales.dim_date', column: 'date_id' } },
      { name: 'customer_id', data_type: 'bigint', nullable: true, foreign_key: { table: 'retail.crm.customer', column: 'customer_id' } },
      { name: 'units', data_type: 'int', nullable: false, comment: 'Units sold' },
      { name: 'gross_sales', data_type: 'decimal(18,2)', nullable: false, comment: 'Gross sales amount' },
      { name: 'net_sales', data_type: 'decimal(18,2)', nullable: false, comment: 'Net sales after discounts', tags: ['monetary'] },
    ],
  },
  {
    catalog: 'retail',
    schema: 'sales',
    name: 'dim_store',
    table_type: 'MANAGED',
    comment: 'Store dimension.',
    owner: 'data_eng',
    tags: ['certified'],
    updated_at: now,
    columns: [
      { name: 'store_id', data_type: 'int', nullable: false, is_primary_key: true },
      { name: 'store_name', data_type: 'string', nullable: false },
      { name: 'region', data_type: 'string', nullable: false, comment: 'Sales region / market' },
      { name: 'country', data_type: 'string', nullable: false },
    ],
  },
  {
    catalog: 'retail',
    schema: 'sales',
    name: 'dim_product',
    table_type: 'MANAGED',
    comment: 'Product dimension.',
    owner: 'data_eng',
    updated_at: now,
    columns: [
      { name: 'product_id', data_type: 'int', nullable: false, is_primary_key: true },
      { name: 'product_name', data_type: 'string', nullable: false },
      { name: 'category', data_type: 'string', nullable: false },
      { name: 'unit_cost', data_type: 'decimal(18,2)', nullable: false, tags: ['monetary'] },
    ],
  },
  {
    catalog: 'retail',
    schema: 'sales',
    name: 'dim_date',
    table_type: 'MANAGED',
    comment: 'Date dimension.',
    owner: 'data_eng',
    updated_at: now,
    columns: [
      { name: 'date_id', data_type: 'int', nullable: false, is_primary_key: true },
      { name: 'calendar_date', data_type: 'date', nullable: false },
      { name: 'month', data_type: 'string', nullable: false },
      { name: 'year', data_type: 'int', nullable: false },
    ],
  },
  {
    catalog: 'retail',
    schema: 'crm',
    name: 'customer',
    table_type: 'MANAGED',
    comment: 'Customer master.',
    owner: 'crm_team',
    tags: ['pii'],
    updated_at: now,
    columns: [
      { name: 'customer_id', data_type: 'bigint', nullable: false, is_primary_key: true },
      { name: 'customer_name', data_type: 'string', nullable: false, tags: ['pii'] },
      { name: 'email', data_type: 'string', nullable: true, tags: ['pii'] },
      { name: 'segment', data_type: 'string', nullable: true },
    ],
  },
  {
    catalog: 'retail',
    schema: 'crm',
    name: 'orders',
    table_type: 'MANAGED',
    comment: 'Customer orders (one row per order).',
    owner: 'crm_team',
    updated_at: now,
    columns: [
      { name: 'order_id', data_type: 'bigint', nullable: false, is_primary_key: true },
      { name: 'customer_id', data_type: 'bigint', nullable: false, foreign_key: { table: 'retail.crm.customer', column: 'customer_id' } },
      { name: 'order_date', data_type: 'date', nullable: false },
      { name: 'order_total', data_type: 'decimal(18,2)', nullable: false, tags: ['monetary'] },
    ],
  },
  {
    catalog: 'retail',
    schema: 'supply',
    name: 'inventory_fact',
    table_type: 'MANAGED',
    comment: 'Inventory positions at product x store x day grain.',
    owner: 'supply_team',
    tags: ['certified', 'supply_chain'],
    updated_at: now,
    columns: [
      { name: 'product_id', data_type: 'int', nullable: false, foreign_key: { table: 'retail.sales.dim_product', column: 'product_id' } },
      { name: 'store_id', data_type: 'int', nullable: false, foreign_key: { table: 'retail.sales.dim_store', column: 'store_id' } },
      { name: 'business_date', data_type: 'date', nullable: false },
      { name: 'inventory_qty', data_type: 'int', nullable: false, comment: 'On-hand inventory units' },
      { name: 'inventory_value', data_type: 'decimal(18,2)', nullable: false, tags: ['monetary'] },
    ],
  },
  {
    catalog: 'retail',
    schema: 'supply',
    name: 'supplier_dim',
    table_type: 'MANAGED',
    comment: 'Supplier dimension.',
    owner: 'supply_team',
    updated_at: now,
    columns: [
      { name: 'supplier_id', data_type: 'int', nullable: false, is_primary_key: true },
      { name: 'supplier_name', data_type: 'string', nullable: false },
      { name: 'lead_time_days', data_type: 'int', nullable: true },
    ],
  },
];

function fq(t: UcTable): string {
  return `${t.catalog}.${t.schema}.${t.name}`;
}

export const MOCK_LINEAGE: LineageEdge[] = [
  { source: 'retail.sales.fact_sales.customer_id', target: 'retail.crm.customer.customer_id', level: 'column', source_system: 'system.access.column_lineage', observed_at: now },
  { source: 'retail.crm.orders.customer_id', target: 'retail.crm.customer.customer_id', level: 'column', source_system: 'system.access.column_lineage', observed_at: now },
  { source: 'retail.sales.fact_sales.store_id', target: 'retail.sales.dim_store.store_id', level: 'column', source_system: 'system.access.column_lineage', observed_at: now },
  { source: 'retail.sales.fact_sales.product_id', target: 'retail.sales.dim_product.product_id', level: 'column', source_system: 'system.access.column_lineage', observed_at: now },
  { source: 'retail.sales.fact_sales', target: 'retail.sales.dim_store', level: 'table', source_system: 'system.access.table_lineage', observed_at: now },
  { source: 'retail.supply.inventory_fact.product_id', target: 'retail.sales.dim_product.product_id', level: 'column', source_system: 'system.access.column_lineage', observed_at: now },
  { source: 'retail.supply.inventory_fact.store_id', target: 'retail.sales.dim_store.store_id', level: 'column', source_system: 'system.access.column_lineage', observed_at: now },
];

export const MOCK_USAGE: QueryUsageSignal[] = [
  { entity_a: 'retail.crm.customer', entity_b: 'retail.crm.orders', join_count: 1482, query_count: 3120, last_seen: now },
  { entity_a: 'retail.sales.fact_sales', entity_b: 'retail.sales.dim_store', join_count: 2210, query_count: 5400, last_seen: now },
  { entity_a: 'retail.sales.fact_sales', entity_b: 'retail.sales.dim_product', join_count: 1980, query_count: 4900, last_seen: now },
  { entity_a: 'retail.sales.fact_sales', entity_b: 'retail.crm.customer', join_count: 640, query_count: 1200, last_seen: now },
  { entity_a: 'retail.supply.inventory_fact', entity_b: 'retail.sales.dim_product', join_count: 870, query_count: 1600, last_seen: now },
];

// Deterministic pseudo-profiles keyed by column asset id.
export const MOCK_PROFILES: Record<string, ProfileStats> = Object.fromEntries(
  MOCK_TABLES.flatMap((t) =>
    t.columns.map((c) => {
      const assetId = `column:${fq(t)}.${c.name}`;
      const isPk = c.is_primary_key === true;
      const isPii = c.tags?.includes('pii');
      return [
        assetId,
        {
          asset_id: assetId,
          row_count: 1_000_000,
          null_pct: c.nullable ? 0.06 : 0.0,
          distinct_count: isPk ? 1_000_000 : 4200,
          approx_cardinality: isPk ? 1_000_000 : 4200,
          uniqueness: isPk ? 1.0 : 0.42,
          duplicate_rate: isPk ? 0.0 : 0.58,
          freshness_ts: now,
          sample_masked: isPii ? ['***', '***'] : undefined,
        } satisfies ProfileStats,
      ];
    }),
  ),
);

export const fqName = fq;
