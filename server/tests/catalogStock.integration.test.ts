import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL?.trim();

test(
  'two PostgreSQL clients cannot debit the last stock unit twice',
  { skip: databaseUrl ? false : 'DATABASE_URL is required for the opt-in integration test' },
  async () => {
    const suffix = randomUUID();
    const productId = `qa-stock-product-${suffix}`;
    const storeId = `qa-stock-store-${suffix}`;
    const clientA = new Client({ connectionString: databaseUrl });
    const clientB = new Client({ connectionString: databaseUrl });
    let clientAConnected = false;
    let clientBConnected = false;

    try {
      await clientA.connect();
      clientAConnected = true;
      await clientB.connect();
      clientBConnected = true;
      await Promise.all([
        clientA.query(`SET statement_timeout = '10s'`),
        clientB.query(`SET statement_timeout = '10s'`),
      ]);

      await clientA.query(
        'INSERT INTO stores (id, payload) VALUES ($1, $2::jsonb)',
        [storeId, JSON.stringify({ name: 'QA temporary store' })],
      );
      await clientA.query(
        `INSERT INTO products (id, category_id, payload, sku, active)
         VALUES ($1, $2, $3::jsonb, $4, TRUE)`,
        [
          productId,
          'qa-temporary',
          JSON.stringify({ id: productId, name: 'QA temporary product' }),
          `QA-${suffix}`,
        ],
      );
      await clientA.query(
        `INSERT INTO product_stock (product_id, store_id, qty, reserved, min_qty)
         VALUES ($1, $2, 1, 0, 0)`,
        [productId, storeId],
      );

      const debit = (client: InstanceType<typeof Client>) => client.query<{ qty: string }>(
        `UPDATE product_stock
         SET qty = qty - 1
         WHERE product_id = $1 AND store_id = $2 AND qty - reserved >= 1
         RETURNING qty::text`,
        [productId, storeId],
      );
      const [first, second] = await Promise.all([debit(clientA), debit(clientB)]);

      assert.equal(Number(first.rowCount) + Number(second.rowCount), 1);
      const final = await clientA.query<{ qty: string; reserved: string }>(
        `SELECT qty::text, reserved::text
         FROM product_stock WHERE product_id = $1 AND store_id = $2`,
        [productId, storeId],
      );
      assert.equal(final.rows.length, 1);
      assert.equal(Number(final.rows[0]!.qty), 0);
      assert.ok(Number(final.rows[0]!.qty) >= 0);
      assert.ok(Number(final.rows[0]!.reserved) <= Number(final.rows[0]!.qty));
    } finally {
      if (clientAConnected) {
        await clientA.query('DELETE FROM products WHERE id = $1', [productId]).catch(() => undefined);
        await clientA.query('DELETE FROM stores WHERE id = $1', [storeId]).catch(() => undefined);
      }
      await Promise.all([
        clientAConnected ? clientA.end() : Promise.resolve(),
        clientBConnected ? clientB.end() : Promise.resolve(),
      ]);
    }
  },
);
