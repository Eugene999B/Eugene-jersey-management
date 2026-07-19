# Sports Shop Platform - Database, API, and Maintenance Reference

Schema summary, API routes, maintenance commands, and extension points.

## Core Models

- Shop, User, Category, AttributeTemplate, AttributeField.
- Product and ProductVariant for flexible sports catalog data.
- Customer, Order, OrderItem, and Payment for sales workflows.
- InviteToken and PasswordResetToken for onboarding and recovery.
- Announcement, AnnouncementDismissal, Notification, SaleHold, ShopPaymentConfig, and AuditLog.

## API Routes

- POST /api/pos/checkout: validates cart, creates order, payment, order items, audit log, and decrements stock.
- PATCH /api/orders/[orderId]/status: updates production status with role restrictions.
- GET /api/receipts/[orderId]: returns printable receipt HTML.

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

- Payment provider webhooks for Paystack or MTN MoMo confirmation.
- Twilio or Africa's Talking notification provider inside a sendNotification service.
- Offline POS queue with local storage and conflict-safe sync.
- Supplier purchase orders and inventory transfers.
- Service bookings and rental scheduling calendars.
- CSV import mapping for bulk catalog upload.

## Backup Notes

- Use managed Postgres automated backups in production.
- Test restore to a staging database regularly.
- Export CSV reports for business records, but do not treat CSV as a full backup.
