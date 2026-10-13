import 'reflect-metadata';
import { before, beforeEach, after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, ForbiddenException, Logger, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { DatabaseService } from '../src/db/database.service';
import { users, campaigns, leads } from '../src/db/schema';
import { UsersService } from '../src/users/users.service';
import { UsersController } from '../src/users/users.controller';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';
import { AuthService } from '../src/auth/auth.service';
import { AuthController } from '../src/auth/auth.controller';
import { RefreshSessionService } from '../src/auth/services/refresh-session.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

// Every run owns a disposable database; the configured database is never modified.
const baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const databaseName = `muxro_users_test_${randomUUID().replace(/-/g, '')}`;
const fixturePassword = 'FixturePass123';
let root: Pool;
let database: DatabaseService;
let management: UsersService;
let auth: AuthService;
let jwt: JwtService;
let strategy: JwtStrategy;
let sessions: RefreshSessionService;
let config: ConfigService;
let admin: typeof users.$inferSelect;
let member: typeof users.$inferSelect;
let passwordHash: string;
let created = false;

before(async () => {
  assert.ok(baseUrl, 'Set TEST_DATABASE_URL or DATABASE_URL to a development PostgreSQL URL with CREATE DATABASE permission');
  Logger.overrideLogger(false);
  root = new Pool({ connectionString: baseUrl });
  await root.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  config = new ConfigService({ DATABASE_URL: url.toString(), JWT_SECRET: randomBytes(32).toString('hex') });
  database = new DatabaseService(config);
  await database.onModuleInit();
  for (const file of ['0000_acoustic_tarot.sql', '0001_whatsapp_tables.sql']) {
    await database.getPool().query(readFileSync(`${__dirname}/../drizzle/${file}`, 'utf8'));
  }
  passwordHash = await bcrypt.hash(fixturePassword, 10);
  management = new UsersService(database);
  sessions = new RefreshSessionService(database);
  jwt = new JwtService({ secret: config.getOrThrow('JWT_SECRET'), signOptions: { expiresIn: '15m' } });
  auth = new AuthService(database, jwt, config, sessions, management);
  strategy = new JwtStrategy(config, database);
});

beforeEach(async () => {
  await database.getPool().query('TRUNCATE "User", "Campaign", "Lead" CASCADE');
  [admin, member] = await database.db.insert(users).values([
    { username: 'admin', name: 'Admin', role: 'ADMIN', password: passwordHash },
    { username: 'member', name: 'Member', role: 'USER', password: passwordHash },
  ]).returning();
});

after(async () => {
  if (database) await database.onModuleDestroy();
  if (created) await root.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  if (root) await root.end();
});

const login = (username = 'admin', password = fixturePassword) => auth.login({ username, password });
const validate = (pair: { access_token: string }) => strategy.validate(jwt.verify(pair.access_token));

test('same-second login, refresh, logout, and re-login use distinct valid sessions', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const first = await login();
  const second = await login();
  assert.ok(first.refresh_token !== second.refresh_token, 'Repeated login must not reuse a token hash');
  assert.ok(first.access_token !== second.access_token, 'Access tokens must also be unique');
  const refreshed = await auth.refreshAccessToken(first.refresh_token);
  assert.equal((await validate(refreshed)).id, admin.id);
  await assert.rejects(() => validate(first), UnauthorizedException);
  await assert.rejects(() => auth.refreshAccessToken(first.refresh_token), UnauthorizedException);
  const principal = await validate(refreshed);
  await auth.logout(principal.sessionId, principal.id);
  await assert.rejects(() => validate(refreshed), UnauthorizedException);
  assert.equal((await validate(await login())).id, admin.id);
  assert.equal((await validate(second)).id, admin.id, 'Logout must leave other sessions intact');
});

test('the last active admin cannot be demoted, deactivated, or permanently deleted', async () => {
  const pair = await login();
  const controller = new UsersController(management);
  const req = { user: { id: admin.id } };
  await assert.rejects(() => controller.update(admin.id, { role: 'USER' }, req), ConflictException);
  await assert.rejects(() => controller.update(admin.id, { isActive: false }, req), ConflictException);
  await assert.rejects(() => controller.remove(admin.id, req), ConflictException);
  await assert.rejects(() => controller.permanentDelete(admin.id, req), ConflictException);
  assert.equal((await validate(pair)).role, 'ADMIN');
  assert.equal((await login()).user.role, 'ADMIN');
});

test('admins cannot remove their own access even when another active admin exists', async () => {
  await management.update(member.id, { role: 'ADMIN' }, admin.id);
  await assert.rejects(() => management.update(admin.id, { role: 'USER' }, admin.id), ForbiddenException);
  await assert.rejects(() => management.remove(admin.id, admin.id), ForbiddenException);
  await assert.rejects(() => management.permanentDelete(admin.id, admin.id), ForbiddenException);
  const pair = await login();
  await management.update(admin.id, { name: 'Renamed Admin' }, admin.id);
  assert.equal((await validate(pair)).role, 'ADMIN', 'Profile edits must keep the admin signed in');
});

test('editing another user revokes only their sessions and the acting admin can log in again', async () => {
  const adminPair = await login();
  const memberPair = await login('member');
  await management.update(member.id, { role: 'ADMIN' }, admin.id);
  await assert.rejects(() => validate(memberPair), UnauthorizedException);
  await assert.rejects(() => auth.refreshAccessToken(memberPair.refresh_token), UnauthorizedException);
  const promoted = await login('member');
  assert.equal((await validate(promoted)).role, 'ADMIN');
  await management.update(member.id, { role: 'USER' }, admin.id);
  await assert.rejects(() => validate(promoted), UnauthorizedException);
  assert.equal((await validate(await login('member'))).role, 'USER');
  assert.equal((await validate(adminPair)).role, 'ADMIN');
  assert.equal((await login()).user.role, 'ADMIN');
});

test('deactivation blocks access, refresh and login; reactivation cannot resurrect old sessions', async () => {
  const adminPair = await login();
  const memberPair = await login('member');
  await management.remove(member.id, admin.id);
  await assert.rejects(() => validate(memberPair), UnauthorizedException);
  await assert.rejects(() => login('member'), UnauthorizedException);
  await assert.rejects(() => auth.refreshAccessToken(memberPair.refresh_token), UnauthorizedException);
  await management.update(member.id, { isActive: true }, admin.id);
  await assert.rejects(() => validate(memberPair), UnauthorizedException);
  assert.equal((await validate(await login('member'))).id, member.id);
  assert.equal((await validate(adminPair)).id, admin.id);
});

test('password reset revokes every target session and leaves the admin session valid', async () => {
  const adminPair = await login();
  const one = await login('member');
  const two = await login('member');
  await management.resetPassword(member.id, 'NewFixturePass123', admin.id);
  for (const pair of [one, two]) {
    await assert.rejects(() => validate(pair), UnauthorizedException);
    await assert.rejects(() => auth.refreshAccessToken(pair.refresh_token), UnauthorizedException);
  }
  await assert.rejects(() => login('member'), UnauthorizedException);
  assert.equal((await validate(await login('member', 'NewFixturePass123'))).id, member.id);
  assert.equal((await validate(adminPair)).id, admin.id);
});

test('a failed password change preserves the session; a successful one revokes all sessions', async () => {
  const one = await login('member');
  const two = await login('member');
  await assert.rejects(() => auth.changePassword(member.id, 'WrongPassword123', 'NewFixturePass123'), UnauthorizedException);
  assert.equal((await validate(one)).id, member.id);
  await auth.changePassword(member.id, fixturePassword, 'NewFixturePass123');
  await assert.rejects(() => validate(one), UnauthorizedException);
  await assert.rejects(() => validate(two), UnauthorizedException);
  assert.equal((await login('member', 'NewFixturePass123')).user.id, member.id);
});

test('failed permanent deletion preserves assigned leads and managed campaigns', async () => {
  const pair = await login();
  const [campaign] = await database.db.insert(campaigns).values({ name: 'Owned campaign', managerId: member.id }).returning();
  const [lead] = await database.db.insert(leads).values({ campaignId: campaign.id, name: 'Owned lead', doerId: member.id }).returning();
  await assert.rejects(() => management.permanentDelete(member.id, admin.id), ConflictException);
  const [retained] = await database.db.select().from(leads).where(eq(leads.id, lead.id));
  assert.equal(retained.isDeleted, false, 'Failed deletion must not hide leads');
  assert.equal(retained.doerId, member.id);
  assert.equal((await management.findOne(member.id)).isActive, true);
  assert.equal((await validate(pair)).role, 'ADMIN');
});

test('deleting an unrelated user does not affect the acting admin login', async () => {
  const adminPair = await login();
  const memberPair = await login('member');
  await management.permanentDelete(member.id, admin.id);
  await assert.rejects(() => validate(memberPair), UnauthorizedException);
  await assert.rejects(() => auth.refreshAccessToken(memberPair.refresh_token), UnauthorizedException);
  assert.equal((await validate(adminPair)).role, 'ADMIN');
  assert.equal((await login()).user.role, 'ADMIN');
});

test('simultaneous admins changing each other cannot remove both admins', async () => {
  await management.update(member.id, { role: 'ADMIN' }, admin.id);
  const results = await Promise.allSettled([
    management.update(member.id, { role: 'USER' }, admin.id),
    management.update(admin.id, { role: 'USER' }, member.id),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await management.findAll()).filter(user => user.isActive && user.role === 'ADMIN').length, 1);
});

test('concurrent refresh consumes the old token once without invalidating the winning session', async () => {
  const pair = await login();
  const results = await Promise.allSettled([
    auth.refreshAccessToken(pair.refresh_token), auth.refreshAccessToken(pair.refresh_token),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const winner = results.find(result => result.status === 'fulfilled');
  assert.ok(winner?.status === 'fulfilled');
  assert.equal((await validate(winner.value)).id, admin.id);
  await assert.rejects(() => validate(pair), UnauthorizedException);
});

test('registration preserves the acting admin and the current database role overrides stale claims', async () => {
  const pair = await login();
  const controller = new AuthController(auth, config);
  const response = await controller.register({ username: 'created', name: 'Created', password: fixturePassword, role: 'USER' }, { user: { id: admin.id } });
  assert.equal(response.user.role, 'USER');
  assert.ok(!('access_token' in response));
  assert.equal((await validate(pair)).role, 'ADMIN');
  const memberPair = await login('member');
  assert.equal((await strategy.validate({ ...jwt.verify(memberPair.access_token), role: 'ADMIN' })).role, 'USER');
  await assert.rejects(() => strategy.validate(jwt.verify(memberPair.refresh_token)), UnauthorizedException);
});

test('legacy refresh sessions upgrade to the new session format without stale roles', async () => {
  const legacy = jwt.sign({ sub: member.id, username: member.username, role: 'ADMIN' }, { expiresIn: '7d' });
  await sessions.createSession(member.id, legacy, new Date(Date.now() + 7 * 86400000));
  const replacement = await auth.refreshAccessToken(legacy);
  assert.equal((await validate(replacement)).role, 'USER');
  await assert.rejects(() => auth.refreshAccessToken(legacy), UnauthorizedException);
});

test('password and null access fields are rejected by the generic update endpoint', async () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  for (const value of [{ password: 'NewFixturePass123' }, { role: null }, { isActive: null }, { username: null }]) {
    await assert.rejects(() => pipe.transform(value, { type: 'body', metatype: UpdateUserDto }));
  }
});

test('session-revocation failure rolls back an account role change', async () => {
  const pair = await login('member');
  await database.getPool().query(`
    CREATE FUNCTION reject_session_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'test revocation failure'; END; $$;
    CREATE TRIGGER reject_session_update BEFORE UPDATE ON "RefreshSession"
      FOR EACH ROW EXECUTE FUNCTION reject_session_update();
  `);
  try {
    await assert.rejects(() => management.update(member.id, { role: 'ADMIN' }, admin.id));
    assert.equal((await management.findOne(member.id)).role, 'USER');
    assert.equal((await validate(pair)).role, 'USER');
  } finally {
    await database.getPool().query('DROP TRIGGER reject_session_update ON "RefreshSession"; DROP FUNCTION reject_session_update();');
  }
});
