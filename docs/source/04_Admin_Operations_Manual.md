# Sports Shop Platform - Admin Operations Manual

How the platform owner manages tenants and global operations.

## Super Admin Dashboard

The /admin dashboard lists every shop with plan tier, status, user count, product count, order count, and creation date. Use it to monitor adoption and operational health across tenants.

## Create a Shop

- Go to /admin/shops/new.
- Enter shop name, slug, first owner name, owner email, and plan tier.
- The app creates the shop and owner in one transaction.
- The generated initial password is printed in the server console for development.

## Suspend or Reactivate

Use Suspend to set Shop.isActive to false. Staff can still authenticate, but they will see the Shop Suspended screen instead of the dashboard. Reactivate restores access.

## Broadcast Announcements

Use the Broadcast form on /admin to create a global announcement. It appears in shop dashboards until dismissed per user. The current implementation stores the announcement and supports dismissal extension through AnnouncementDismissal.

## Audit Trail

Admin actions write AuditLog records with the affected shop where applicable. Shop detail pages show recent audit activity.
