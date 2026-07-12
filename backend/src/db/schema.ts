import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  json,
  integer,
  text,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('Role', ['ADMIN', 'USER']);

export const users = pgTable(
  'User',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    role: roleEnum('role').notNull().default('USER'),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('User_role_idx').on(table.role),
    index('User_isActive_idx').on(table.isActive),
  ],
);

export const campaigns = pgTable(
  'Campaign',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    managerId: uuid('managerId').references(() => users.id),
  },
  (table) => [
    index('Campaign_managerId_idx').on(table.managerId),
    index('Campaign_isActive_idx').on(table.isActive),
  ],
);

export const campaignUsers = pgTable(
  'CampaignUser',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaignId')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isActive: boolean('isActive').notNull().default(true),
    assignedAt: timestamp('assignedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('CampaignUser_campaignId_userId_key').on(table.campaignId, table.userId),
    index('CampaignUser_campaignId_idx').on(table.campaignId),
    index('CampaignUser_userId_idx').on(table.userId),
    index('CampaignUser_isActive_idx').on(table.isActive),
  ],
);

export const campaignStatuses = pgTable(
  'CampaignStatus',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaignId')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    color: varchar('color', { length: 50 }).notNull().default('#3B82F6'),
    order: integer('order').notNull().default(0),
    whatsappMessage: varchar('whatsappMessage', { length: 1000 }),
  },
  (table) => [
    index('CampaignStatus_campaignId_idx').on(table.campaignId),
  ],
);

export const forms = pgTable(
  'Form',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaignId')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    fields: json('fields').default([]).$type<any[]>(),
    isPublished: boolean('isPublished').notNull().default(false),
    publicSlug: varchar('publicSlug', { length: 255 }).notNull().unique(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('Form_campaignId_idx').on(table.campaignId),
    index('Form_isPublished_idx').on(table.isPublished),
  ],
);

export const enquiries = pgTable(
  'Enquiry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('formId')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    data: json('data').notNull(),
    submittedAt: timestamp('submittedAt').notNull().defaultNow(),
    ipAddress: varchar('ipAddress', { length: 45 }),
  },
  (table) => [
    index('Enquiry_formId_submittedAt_idx').on(table.formId, table.submittedAt),
    index('Enquiry_submittedAt_idx').on(table.submittedAt),
  ],
);

export const leads = pgTable(
  'Lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaignId')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    enquiryId: uuid('enquiryId').unique().references(() => enquiries.id),
    indiamartQueryId: varchar('indiamartQueryId', { length: 255 }).unique(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    source: varchar('source', { length: 100 }).notNull().default('manual'),
    customData: json('customData'),
    dnd: boolean('dnd').notNull().default(false),
    isDeleted: boolean('isDeleted').notNull().default(false),
    deletedAt: timestamp('deletedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    doerId: uuid('doerId').references(() => users.id),
    statusId: uuid('statusId').references(() => campaignStatuses.id),
  },
  (table) => [
    index('Lead_campaignId_idx').on(table.campaignId),
    index('Lead_doerId_idx').on(table.doerId),
    index('Lead_statusId_idx').on(table.statusId),
    index('Lead_source_idx').on(table.source),
    index('Lead_dnd_idx').on(table.dnd),
    index('Lead_name_idx').on(table.name),
    index('Lead_createdAt_idx').on(table.createdAt),
    index('Lead_updatedAt_idx').on(table.updatedAt),
    index('Lead_campaignId_doerId_idx').on(table.campaignId, table.doerId),
    index('Lead_campaignId_statusId_idx').on(table.campaignId, table.statusId),
    index('Lead_doerId_dnd_idx').on(table.doerId, table.dnd),
  ],
);

export const followups = pgTable(
  'Followup',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('leadId')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 255 }).notNull(),
    remarks: varchar('remarks', { length: 1000 }),
    nextCallDate: timestamp('nextCallDate'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('Followup_leadId_idx').on(table.leadId),
    index('Followup_userId_idx').on(table.userId),
    index('Followup_nextCallDate_idx').on(table.nextCallDate),
    index('Followup_createdAt_idx').on(table.createdAt),
    index('Followup_userId_nextCallDate_idx').on(table.userId, table.nextCallDate),
  ],
);

export const notifications = pgTable(
  'Notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followupId: uuid('followupId')
      .notNull()
      .references(() => followups.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    isRead: boolean('isRead').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('Notification_userId_followupId_key').on(table.userId, table.followupId),
    index('Notification_userId_isRead_idx').on(table.userId, table.isRead),
    index('Notification_userId_createdAt_idx').on(table.userId, table.createdAt),
    index('Notification_type_idx').on(table.type),
  ],
);

export const settings = pgTable(
  'Setting',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    encryptedValue: varchar('encryptedValue', { length: 2000 }).notNull(),
    isEncrypted: boolean('isEncrypted').notNull().default(true),
    lastTestedAt: timestamp('lastTestedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('Setting_key_idx').on(table.key),
    index('Setting_updatedAt_idx').on(table.updatedAt),
  ],
);

export const settingAuditLogs = pgTable(
  'SettingAuditLog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settingId: uuid('settingId')
      .notNull()
      .references(() => settings.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 50 }).notNull().default('update'),
    changedBy: varchar('changedBy', { length: 255 }),
    oldValue: varchar('oldValue', { length: 2000 }),
    newValue: varchar('newValue', { length: 2000 }),
    reason: varchar('reason', { length: 500 }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('SettingAuditLog_settingId_idx').on(table.settingId),
    index('SettingAuditLog_createdAt_idx').on(table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignUser = typeof campaignUsers.$inferSelect;
export type NewCampaignUser = typeof campaignUsers.$inferInsert;
export type CampaignStatus = typeof campaignStatuses.$inferSelect;
export type NewCampaignStatus = typeof campaignStatuses.$inferInsert;
export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type Enquiry = typeof enquiries.$inferSelect;
export type NewEnquiry = typeof enquiries.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Followup = typeof followups.$inferSelect;
export type NewFollowup = typeof followups.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type SettingAuditLog = typeof settingAuditLogs.$inferSelect;
export type NewSettingAuditLog = typeof settingAuditLogs.$inferInsert;
export type Role = (typeof roleEnum.enumValues)[number];
