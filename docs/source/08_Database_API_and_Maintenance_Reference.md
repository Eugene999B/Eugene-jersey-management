# Sports Shop Platform - Database, API, and Maintenance Reference

Schema summary, API routes, maintenance commands, and extension points.

## Core Models

- Shop, User, Category, AttributeTemplate, AttributeField.
- Product and ProductVariant for flexible sports catalog data.
- Customer, Order, OrderItem, and Payment for sales workflows.
- Debt and DebtInstallment for credit sales and structured repayments.
- DailyClosing for end-of-day manual cash count, expected totals, and variance tracking.
- Supplier, SupplierOrder, and SupplierOrderItem for supplier portal, purchase orders, and stock receiving.
- ShopNetworkLink, ShopNetworkOrder, and ShopNetworkOrderItem for trusted shop-to-shop requests and exchanges.
- CustomerThread, CustomerChatMessage, CustomerMessage, and DesignJob for customer communication and production workflows.
- InviteToken and PasswordResetToken for onboarding and recovery.
- Announcement, AnnouncementDismissal, Notification, SaleHold, ShopPaymentConfig, and AuditLog.

## API Routes

- POST /api/pos/checkout: validates cart, creates order, payment, order items, audit log, and decrements stock.
- POST /api/pos/checkout with STORE_CREDIT: creates a pending payment plus Debt and DebtInstallment records.
- PATCH /api/orders/[orderId]/status: updates production status with role restrictions.
- GET /api/receipts/[orderId]: returns printable receipt HTML.
- POST /api/public-order: creates public shop orders and initializes Paystack payments with optional shop subaccount routing.
- GET /api/exports: returns protected PDF, Word, or Excel-compatible exports by module.

## Maintenance Commands

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run docs:generate
```

## Next Extension Points

- Payment provider webhooks for Paystack or MTN MoMo confirmation, refunds, and reconciliation.
- Twilio, Africa's Talking, or WhatsApp Business provider implementation inside the messaging service.
- Offline POS queue with local storage and conflict-safe sync.
- Direct cutter or plotter driver bridges for exact machine models.
- Service bookings and rental scheduling calendars.
- CSV import mapping for bulk catalog upload.

## Backup Notes

- Use managed Postgres automated backups in production.
- Test restore to a staging database regularly.
- Export CSV reports for business records, but do not treat CSV as a full backup.
