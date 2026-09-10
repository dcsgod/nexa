/**
 * Enterprise glossary seed (spec §7, §23). In live mode these come from an
 * enterprise glossary / stewards; in mock mode we seed a realistic retail set.
 * Business synonyms are NOT treated as identical metrics (spec §52 rule 7).
 */
import type { BusinessConcept, Metric } from '../../domain/types.js';

const now = '2026-09-10T00:00:00Z';

export const SEED_CONCEPTS: Omit<BusinessConcept, 'concept_id'>[] = [
  { name: 'Revenue', type: 'business_metric', domain: 'finance', status: 'proposed', updated_at: now,
    definition: 'Net sales recognized from transactions.', synonyms: ['sales', 'net revenue', 'turnover'] },
  { name: 'Gross Sales', type: 'business_metric', domain: 'finance', status: 'proposed', updated_at: now,
    definition: 'Total sales before discounts and returns.', synonyms: ['gross', 'gross revenue'] },
  { name: 'Net Sales', type: 'business_metric', domain: 'finance', status: 'proposed', updated_at: now,
    definition: 'Sales after discounts and returns.', synonyms: ['net'] },
  { name: 'Units Sold', type: 'business_metric', domain: 'sales', status: 'proposed', updated_at: now,
    definition: 'Count of product units sold.', synonyms: ['units', 'quantity sold'] },
  { name: 'Region', type: 'dimension', domain: 'sales', status: 'proposed', updated_at: now,
    definition: 'Geographic sales region / market.', synonyms: ['market', 'territory', 'area'] },
  { name: 'Customer', type: 'business_entity', domain: 'crm', status: 'proposed', updated_at: now,
    definition: 'A purchasing customer.', synonyms: ['client', 'account'] },
  { name: 'Inventory Units', type: 'business_metric', domain: 'supply_chain', status: 'proposed', updated_at: now,
    definition: 'On-hand inventory quantity.', synonyms: ['on hand', 'stock units', 'inventory quantity'] },
  { name: 'Inventory Value', type: 'business_metric', domain: 'supply_chain', status: 'proposed', updated_at: now,
    definition: 'Monetary value of on-hand inventory.', synonyms: ['stock value'] },
  { name: 'Supplier', type: 'business_entity', domain: 'supply_chain', status: 'proposed', updated_at: now,
    definition: 'A goods supplier / vendor.', synonyms: ['vendor'] },
];

export const SEED_METRICS: Omit<Metric, 'metric_id'>[] = [
  { name: 'Revenue', definition: 'Sum of net sales.', expression: 'SUM(net_sales)', grain: 'transaction',
    dimensions: ['store', 'product', 'date'], source: 'retail.sales.fact_sales', status: 'proposed', updated_at: now },
  { name: 'Gross Sales', definition: 'Sum of gross sales.', expression: 'SUM(gross_sales)', grain: 'transaction',
    dimensions: ['store', 'product', 'date'], source: 'retail.sales.fact_sales', status: 'proposed', updated_at: now },
  { name: 'Units Sold', definition: 'Sum of units.', expression: 'SUM(units)', grain: 'transaction',
    dimensions: ['store', 'product', 'date'], source: 'retail.sales.fact_sales', status: 'proposed', updated_at: now },
  { name: 'Inventory Units', definition: 'Sum of on-hand quantity.', expression: 'SUM(inventory_qty)',
    grain: 'product_store_day', dimensions: ['product', 'store', 'date'],
    source: 'retail.supply.inventory_fact', status: 'proposed', updated_at: now },
  { name: 'Inventory Value', definition: 'Sum of inventory value.', expression: 'SUM(inventory_value)',
    grain: 'product_store_day', dimensions: ['product', 'store', 'date'],
    source: 'retail.supply.inventory_fact', status: 'proposed', updated_at: now },
];
