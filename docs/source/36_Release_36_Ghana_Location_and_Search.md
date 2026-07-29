# Release 36 — Ghana Location Directory and Marketplace Search

## Objective

Make business locations accurate from registration through marketplace discovery, while keeping the location structure maintainable as districts and communities change.

## Ghana location hierarchy

The application has a fixed canonical list of Ghana's 16 regions. District, municipal and metropolitan suggestions are loaded from the Ghana National Household Registry location directory. Town and community suggestions are then loaded under the selected district.

The hierarchy is:

1. Country — Ghana
2. Region — one of the 16 canonical regions
3. District, Municipal or Metropolitan Assembly
4. Town, city or community
5. Suburb, area or sub-town
6. GhanaPost GPS digital address
7. Street, building or shop number
8. Nearby landmark and directions
9. Optional latitude and longitude

District and community suggestions are cached for 24 hours. Manual entry remains available because official spellings, administrative boundaries and community records can change, and a newly recognised locality must not prevent a legitimate business from registering.

## Shop registration and approval

New shop applications must provide region, district and town/community. The additional address fields improve physical verification and customer discovery.

The structured location is stored separately from the legacy free-text application address. During administrator review, every location level is shown clearly. When the application is approved, a database trigger copies the approved location into the new shop record in the same transaction.

Supplier applications may provide a location but are not forced to complete the full shop hierarchy.

## Shop settings

Shop owners can update the complete business location from Shop Settings. Existing shops may complete their structured location when ready without blocking unrelated settings changes. After a structured location exists, region, district and town are maintained together.

A location update also keeps the legacy shop city and address fields synchronised for receipts and older screens.

## Marketplace search

Marketplace search now supports:

- free-text search across shop name, item name, description, brand, team, sport, product type, category and registered location
- region
- district or municipality
- town, city or community
- suburb, area or sub-town
- category
- brand
- team
- condition
- in-stock availability
- ordering-open status
- name, newest-shop and catalogue-size sorting

Filters remain URL-backed, mobile-safe and clearable. Shop cards display the registered area, town, district, region and GhanaPost GPS code when available.

## Data isolation and safety

`ShopLocation` is one-to-one by `shopId`. `BusinessApplicationLocation` is one-to-one by `applicationId`. Both have cascading foreign keys and administrative indexes.

Authenticated shop settings use the verified session shop ID for every unrestricted platform-client operation. Public marketplace location queries only read locations belonging to active, verified and publicly visible shops.

No product, stock, order, payment or historical address record is deleted by this release.
