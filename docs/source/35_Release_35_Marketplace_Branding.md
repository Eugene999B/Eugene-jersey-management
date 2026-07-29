# Release 35 — Marketplace Branding and Discovery

## Objective

Make the public marketplace feel like a professional sports shopping destination while giving every verified shop control over the image and message customers see first.

## Shop-controlled branding

Shop Settings now includes:

- shop name / brand name
- marketplace tagline
- square shop logo upload
- a separate marketplace featured photo upload
- a control to remove the featured photo and return to the logo
- a live marketplace-card preview

The marketplace visual priority is:

1. the shop-selected marketplace featured photo
2. the shop logo
3. a recent product image only when the shop has not supplied a logo
4. the EJM fallback mark

Uploaded marketplace photos use the durable compressed media pipeline and the full image is fitted inside the card without crop-to-fill.

## Marketplace experience

The marketplace now provides:

- a stronger discovery hero and clear buyer/shop actions
- responsive keyword, location, category, ordering and sorting filters
- quick category and location discovery links
- branded shop cards using each shop's primary and secondary colours
- verified and ordering-status indicators
- shop tagline, location, review and catalogue counts
- product brand badges derived from each product's Brand field
- recent product previews with full photos, brand/team details and prices
- direct open-shop and message actions
- polished desktop and mobile layouts with hover and focus feedback

## Data safety and tenancy

Marketplace branding is stored in one `ShopMarketplaceProfile` record per shop. A database foreign key deletes the profile when its shop is deleted. All reads and writes use the authenticated or queried shop ID; no shop can write another shop's profile.

No product, stock, order, payment or existing logo records are rewritten by this release.
