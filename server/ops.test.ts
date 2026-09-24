import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { backupDb } from './backup';
import { openDb } from './db';
import { MemoryMailer } from './mailer';

describe('security headers and health', () => {
  it('sends protective headers, and no caching for API responses', async () => {
    const app = buildApp({ db: openDb(':memory:'), mailer: new MemoryMailer(), hsts: true });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('reports unhealthy if the database is gone', async () => {
    const db = openDb(':memory:');
    const app = buildApp({ db, mailer: new MemoryMailer() });
    db.close();
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(503);
  });

  it('uses the proxy\'s client address only when told to trust it', async () => {
    const trusting = buildApp({ db: openDb(':memory:'), mailer: new MemoryMailer(), trustProxy: true });
    trusting.get('/api/ip', async (req) => ({ ip: req.ip }));
    const plain = buildApp({ db: openDb(':memory:'), mailer: new MemoryMailer() });
    plain.get('/api/ip', async (req) => ({ ip: req.ip }));
    const headers = { 'x-forwarded-for': '203.0.113.9' };
    expect((await trusting.inject({ method: 'GET', url: '/api/ip', headers })).json().ip).toBe('203.0.113.9');
    expect((await plain.inject({ method: 'GET', url: '/api/ip', headers })).json().ip).not.toBe('203.0.113.9');
  });
});

describe('backups', () => {
  it('writes a restorable copy and keeps only the most recent ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sz-backup-'));
    const db = openDb(join(dir, 'live.db'));
    db.prepare("INSERT INTO parents (id, email, password_hash, created_at) VALUES ('p', 'a@b.co', 'h', 0)").run();
    const backups = join(dir, 'backups');
    for (let d = 1; d <= 5; d++) backupDb(db, backups, new Date(`2026-09-0${d}T03:00:00Z`), 3);
    const files = readdirSync(backups).sort();
    expect(files).toEqual(['schoolzone-2026-09-03.db', 'schoolzone-2026-09-04.db', 'schoolzone-2026-09-05.db']);
    // Restoring: the backup opens as a normal database with the data in it.
    const restored = openDb(join(backups, files[2]));
    expect((restored.prepare('SELECT email FROM parents').get() as { email: string }).email).toBe('a@b.co');
    restored.close();
    // Running twice on the same day replaces that day's file.
    backupDb(db, backups, new Date('2026-09-05T20:00:00Z'), 3);
    expect(readdirSync(backups).filter((f) => f.endsWith('.db'))).toHaveLength(3);
  });
});
