# Sports Shop Platform - Admin Operations Manual

How the platform owner manages tenants and global operations.

## Super Admin Dashboard

The /admin dashboard lists every shop with plan tier, status, user count, product count, order count, and creation date. Use it to monitor adoption and operational health across tenants.

The dashboard also estimates monthly recurring revenue, shows open debt, recent platform activity, subscription state, and tenant usage signals.

## Create a Shop

- Go to /admin/shops/new.
- Enter shop name, slug, first owner name, owner email, and plan tier.
- The app creates the shop and owner in one transaction.
- The app also creates a unique shop network code and an empty payment configuration record for the tenant.
- The generated initial password is printed in the server console for development.

## Suspend or Reactivate

Use Suspend to set Shop.isActive to false. Staff can still authenticate, but they will see the Shop Suspended screen instead of the dashboard. Reactivate restores access.

## Broadcast Announcements

Use the Broadcast form on /admin to create a global announcement. It appears in shop dashboards until dismissed per user. The current implementation stores the announcement and supports dismissal extension through AnnouncementDismissal.

## Plans, Renewals, and Payment Routing

- Use Subscription update to change plan tier, monthly or yearly billing, pricing, renewal date, and subscription status.
- Use each shop's detail page to inspect renewal status, supplier count, debt records, closing count, Paystack subaccount status, and mobile money settlement details.
- The platform uses the server PAYSTACK_SECRET_KEY. Shops store their own Paystack subaccount code and mobile money details from Settings.
- Before real money collection, create or verify the shop's Paystack subaccount in Paystack and paste the subaccount code into the shop settings page.

## Audit Trail

Admin actions write AuditLog records with the affected shop where applicable. Shop detail pages show recent audit activity.
