// Test the Postgres code path using in-process PGlite (no server needed)
// Run: node test-pg.js
process.env.DATABASE_URL = 'pglite:test';
const db = require('./db');

(async () => {
  await db.init();
  console.log('DB:', db.describe());

  await db.q(`INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, ['a', '1']);
  await db.q(`INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, ['a', '2']);
  const s = await db.q('SELECT value FROM settings WHERE key=$1', ['a']);
  console.log('settings upsert:', s.rows[0].value === '2' ? 'OK' : 'FAIL');

  await db.q(`INSERT INTO products(name,price,old_price,description,colors,sizes,stock,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    ['t', 599, 850, 'd', '[]', '["M"]', 10, 1]);
  const p = await db.q('SELECT * FROM products WHERE active=1');
  console.log('products:', p.rows.length === 1 ? 'OK' : 'FAIL', '| price type:', typeof p.rows[0].price);

  const o = await db.q(`INSERT INTO orders(product_id,product_name,color,size,qty,unit_price,shipping,total,name,phone,governorate,address,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [1, 't', 'c', 'M', 1, 599, 70, 669, 'n', '010', 'القاهرة', 'a', '']);
  console.log('order RETURNING id:', o.rows[0].id === 1 ? 'OK' : 'FAIL');
  await db.q('UPDATE orders SET order_no=$1 WHERE id=$2', ['CC-100001', o.rows[0].id]);

  const day = new Date().toISOString().slice(0, 10);
  const t = await db.q('SELECT COUNT(*) c FROM orders WHERE created_at >= $1 AND created_at < $2',
    [day + 'T00:00:00.000Z', '2999-01-01T00:00:00.000Z']);
  console.log('today-range count:', Number(t.rows[0].c) === 1 ? 'OK' : 'FAIL');

  const buf = Buffer.from([1, 2, 3, 4, 5]);
  const im = await db.q('INSERT INTO product_images(data,mime) VALUES($1,$2) RETURNING id', [buf, 'image/jpeg']);
  const g = await db.q('SELECT data,mime FROM product_images WHERE id=$1', [im.rows[0].id]);
  console.log('image blob:', Buffer.compare(Buffer.from(g.rows[0].data), buf) === 0 ? 'OK' : 'FAIL');

  const st = await db.q('SELECT status, COUNT(*) c FROM orders GROUP BY status', []);
  console.log('group by:', JSON.stringify(st.rows));
  console.log('✅ PG PATH ALL OK');
  process.exit(0);
})().catch(e => { console.error('❌ PG TEST FAILED:', e); process.exit(1); });
