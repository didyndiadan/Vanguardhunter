import { pgTable, text, serial, boolean, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const siteConfigTable = pgTable("site_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SiteConfig = typeof siteConfigTable.$inferSelect;

export const emailAccountsTable = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().default(""),
  provider: text("provider").notNull().default("gmail"),
  host: text("host").notNull().default("smtp.gmail.com"),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false),
  user: text("user").notNull().default(""),
  password: text("password").notNull().default(""),
  fromName: text("from_name").notNull().default("AI Business Hunter"),
  fromEmail: text("from_email").notNull().default(""),
  imapEnabled: boolean("imap_enabled").notNull().default(false),
  imapHost: text("imap_host").notNull().default("imap.gmail.com"),
  imapPort: integer("imap_port").notNull().default(993),
  active: boolean("active").notNull().default(true),
  sentCount: integer("sent_count").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(0),
  sentToday: integer("sent_today").notNull().default(0),
  lastSentDay: text("last_sent_day").notNull().default(""),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastError: text("last_error").notNull().default(""),
  lastErrorAt: timestamp("last_error_at"),
  autoPaused: boolean("auto_paused").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const automationSettingsTable = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  autoHuntEnabled: boolean("auto_hunt_enabled").notNull().default(false),
  huntCategory: text("hunt_category").notNull().default("Restaurant"),
  huntCity: text("hunt_city").notNull().default("Austin"),
  huntCountry: text("hunt_country").notNull().default("USA"),
  huntCount: integer("hunt_count").notNull().default(10),
  huntExtraContext: text("hunt_extra_context").notNull().default(""),
  huntIntervalHours: integer("hunt_interval_hours").notNull().default(24),
  autoScore: boolean("auto_score").notNull().default(true),
  autoEmail: boolean("auto_email").notNull().default(false),
  emailDelayMinutes: integer("email_delay_minutes").notNull().default(20),
  autoReply: boolean("auto_reply").notNull().default(false),
  followUpEnabled: boolean("follow_up_enabled").notNull().default(false),
  followUpDays: integer("follow_up_days").notNull().default(4),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runStats: jsonb("run_stats").default("{}"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailTrackingTable = pgTable("email_tracking", {
  id: serial("id").primaryKey(),
  trackingId: text("tracking_id").notNull().unique(),
  prospectEmail: text("prospect_email").notNull().default(""),
  emailType: text("email_type").notNull().default("outreach"),
  subject: text("subject").notNull().default(""),
  opens: integer("opens").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  firstOpenAt: timestamp("first_open_at"),
  lastOpenAt: timestamp("last_open_at"),
  firstClickAt: timestamp("first_click_at"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (t) => [index("idx_email_tracking_email").on(t.prospectEmail)]);

export const followUpQueueTable = pgTable("follow_up_queue", {
  id: serial("id").primaryKey(),
  prospectEmail: text("prospect_email").notNull(),
  businessName: text("business_name").notNull().default(""),
  originalSubject: text("original_subject").notNull().default(""),
  originalBody: text("original_body").notNull().default(""),
  firstSentAt: timestamp("first_sent_at").notNull().defaultNow(),
  followUpSentAt: timestamp("follow_up_sent_at"),
  followUpDays: integer("follow_up_days").notNull().default(4),
  accountId: integer("account_id"),
  status: text("status").notNull().default("pending"), // pending | sent | skipped | opened
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inboxRepliesTable = pgTable("inbox_replies", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull().unique(),
  accountId: integer("account_id"),
  prospectEmail: text("prospect_email").notNull().default(""),
  businessName: text("business_name").notNull().default(""),
  subject: text("subject").notNull().default(""),
  bodyText: text("body_text").notNull().default(""),
  classification: text("classification").notNull().default("other"),
  aiResponse: text("ai_response").notNull().default(""),
  aiRepliedAt: timestamp("ai_replied_at"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  read: boolean("read").notNull().default(false),
});

export const externalApiKeysTable = pgTable("external_api_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // 'foursquare' | 'tomtom' | 'here' | 'gemini'
  label: text("label").notNull().default(""),
  apiKey: text("api_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const websiteReportsTable = pgTable("website_reports", {
  reportId: text("report_id").primaryKey(),
  businessName: text("business_name").notNull().default(""),
  website: text("website").notNull().default(""),
  analysisData: jsonb("analysis_data").default("{}"),
  reportUrl: text("report_url").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  firstViewed: timestamp("first_viewed"),
  lastViewed: timestamp("last_viewed"),
  totalViews: integer("total_views").notNull().default(0),
  proposalRequested: boolean("proposal_requested").notNull().default(false),
  status: text("status").notNull().default("active"), // active | proposal_sent | client_replied | won
  lastNotifiedAt: timestamp("last_notified_at"),
});

export const affiliateCampaignsTable = pgTable("affiliate_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  emailSubject: text("email_subject").notNull().default(""),
  emailTemplate: text("email_template").notNull().default(""),
  affiliateLink: text("affiliate_link").notNull().default(""),
  sendIntervalMinutes: integer("send_interval_minutes").notNull().default(5),
  status: text("status").notNull().default("draft"),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  totalContacts: integer("total_contacts").notNull().default(0),
  opensCount: integer("opens_count").notNull().default(0),
  clicksCount: integer("clicks_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const affiliateContactsTable = pgTable("affiliate_contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  businessName: text("business_name").notNull().default(""),
  ownerName: text("owner_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  website: text("website").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  category: text("category").notNull().default(""),
  status: text("status").notNull().default("pending"),
  generatedMessage: text("generated_message").notNull().default(""),
  generatedSubject: text("generated_subject").notNull().default(""),
  trackingId: text("tracking_id").notNull().default(""),
  sentAt: timestamp("sent_at"),
  errorMsg: text("error_msg").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("idx_affiliate_contacts_campaign").on(t.campaignId)]);

export const crmProspectsTable = pgTable("crm_prospects", {
  id: text("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  company: text("company").notNull().default(""),
  role: text("role").notNull().default(""),
  website: text("website").notNull().default(""),
  industry: text("industry").notNull().default(""),
  location: text("location").notNull().default(""),
  companySize: text("company_size").notNull().default("1-10"),
  service: text("service").notNull().default(""),
  stage: text("stage").notNull().default("lead"),
  priority: text("priority").notNull().default("medium"),
  dealValue: integer("deal_value").notNull().default(2500),
  source: text("source").notNull().default("ai_hunter"),
  aiScore: integer("ai_score"),
  payload: jsonb("payload").default("{}"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const saasUsersTable = pgTable("saas_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull().default(""),
  companyName: text("company_name").notNull().default(""),
  role: text("role").notNull().default("user"), // 'user' | 'admin'
  planId: text("plan_id").notNull().default("starter"), // 'starter' | 'growth' | 'scale' | 'enterprise'
  billingCycle: text("billing_cycle").notNull().default("monthly"), // 'monthly' | 'annual'
  subscriptionStatus: text("subscription_status").notNull().default("active"), // 'active' | 'trialing' | 'past_due' | 'canceled'
  huntsUsedThisMonth: integer("hunts_used_this_month").notNull().default(0),
  emailsSentThisMonth: integer("emails_sent_this_month").notNull().default(0),
  auditsRunThisMonth: integer("audits_run_this_month").notNull().default(0),
  creditsBalance: integer("credits_balance").notNull().default(250),
  status: text("status").notNull().default("active"), // 'active' | 'suspended'
  sessionToken: text("session_token").notNull().default(""),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saasPlansTable = pgTable("saas_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  audience: text("audience").notNull().default(""),
  tagline: text("tagline").notNull().default(""),
  monthlyPrice: integer("monthly_price").notNull().default(49),
  annualPrice: integer("annual_price").notNull().default(39),
  monthlyHuntLimit: integer("monthly_hunt_limit").notNull().default(500),
  monthlyEmailLimit: integer("monthly_email_limit").notNull().default(2500),
  maxEmailAccounts: integer("max_email_accounts").notNull().default(3),
  bulkHuntEnabled: boolean("bulk_hunt_enabled").notNull().default(false),
  autoPilotEnabled: boolean("auto_pilot_enabled").notNull().default(false),
  lemonCheckoutUrl: text("lemon_checkout_url").notNull().default(""),
  lemonVariantId: text("lemon_variant_id").notNull().default(""),
  features: jsonb("features").default("[]"),
  isPopular: boolean("is_popular").notNull().default(false),
  active: boolean("active").notNull().default(true),
});

export const saasPaymentsTable = pgTable("saas_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull().default(""),
  planId: text("plan_id").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  amountUsd: integer("amount_usd").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'lemon_squeezy' | 'crypto_usdt_trc20' | 'crypto_usdt_erc20' | 'crypto_btc' | 'crypto_eth' | 'crypto_sol'
  cryptoNetwork: text("crypto_network").notNull().default(""),
  walletAddress: text("wallet_address").notNull().default(""),
  txHashOrRef: text("tx_hash_or_ref").notNull().default(""),
  status: text("status").notNull().default("pending"), // 'completed' | 'pending' | 'rejected'
  adminNote: text("admin_note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

export const userActivitiesTable = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userEmail: text("user_email").notNull().default(""),
  userName: text("user_name").notNull().default(""),
  category: text("category").notNull().default("system"), // 'auth' | 'hunt' | 'audit' | 'email' | 'billing' | 'admin' | 'support'
  action: text("action").notNull(),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("idx_user_activities_user").on(t.userId)]);

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  userId: integer("user_id").notNull(),
  userEmail: text("user_email").notNull().default(""),
  userName: text("user_name").notNull().default(""),
  senderRole: text("sender_role").notNull().default("user"), // 'user' | 'admin'
  senderName: text("sender_name").notNull().default(""),
  subject: text("subject").notNull().default(""),
  category: text("category").notNull().default("general"), // 'general' | 'billing' | 'technical' | 'plan_upgrade' | 'announcement'
  body: text("body").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'replied' | 'resolved'
  readByUser: boolean("read_by_user").notNull().default(false),
  readByAdmin: boolean("read_by_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_support_messages_user").on(t.userId),
  index("idx_support_messages_thread").on(t.threadId),
]);

export const generatedWebsitesTable = pgTable("generated_websites", {
  siteId: text("site_id").primaryKey(),
  prospectId: text("prospect_id").notNull().default(""),
  businessName: text("business_name").notNull().default(""),
  ownerName: text("owner_name").notNull().default(""),
  category: text("category").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default("USA"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  originalWebsite: text("original_website").notNull().default(""),
  detectionStatus: text("detection_status").notNull().default("no_website"), // 'no_website' | 'bad_website' | 'upgrade_ready'
  originalScore: integer("original_score").notNull().default(0),
  themeId: text("theme_id").notNull().default("valley_craft"),
  siteConfig: jsonb("site_config").default("{}"),
  siteUrl: text("site_url").notNull().default(""),
  pitchSubject: text("pitch_subject").notNull().default(""),
  pitchBody: text("pitch_body").notNull().default(""),
  status: text("status").notNull().default("ready"), // 'ready' | 'pitched' | 'viewed' | 'claimed'
  totalViews: integer("total_views").notNull().default(0),
  funnelSubmissionsCount: integer("funnel_submissions_count").notNull().default(0),
  funnelSubmissions: jsonb("funnel_submissions").default("[]"),
  claimRequested: boolean("claim_requested").notNull().default(false),
  claimData: jsonb("claim_data").default("{}"),
  createdByEmail: text("created_by_email").notNull().default("jwandersonar@gmail.com"),
  firstViewedAt: timestamp("first_viewed_at"),
  lastViewedAt: timestamp("last_viewed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type EmailAccount = typeof emailAccountsTable.$inferSelect;
export type AutomationSettings = typeof automationSettingsTable.$inferSelect;
export type EmailTracking = typeof emailTrackingTable.$inferSelect;
export type FollowUpQueue = typeof followUpQueueTable.$inferSelect;
export type InboxReply = typeof inboxRepliesTable.$inferSelect;
export type ExternalApiKey = typeof externalApiKeysTable.$inferSelect;
export type WebsiteReport = typeof websiteReportsTable.$inferSelect;
export type AffiliateCampaign = typeof affiliateCampaignsTable.$inferSelect;
export type AffiliateContact = typeof affiliateContactsTable.$inferSelect;
export type CrmProspectRow = typeof crmProspectsTable.$inferSelect;
export type SaasUser = typeof saasUsersTable.$inferSelect;
export type SaasPlan = typeof saasPlansTable.$inferSelect;
export type SaasPayment = typeof saasPaymentsTable.$inferSelect;
export type UserActivity = typeof userActivitiesTable.$inferSelect;
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
export type GeneratedWebsite = typeof generatedWebsitesTable.$inferSelect;
