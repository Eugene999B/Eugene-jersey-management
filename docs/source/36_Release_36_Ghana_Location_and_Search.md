# Release 36 — Ghana Location Directory and Marketplace Search

## Objective

Make business locations accurate from registration through marketplace discovery, while keeping required registration and settings fields available even when an external location provider is unavailable.

## Ghana location hierarchy

The application has a fixed canonical list of Ghana's 16 regions. District, municipal and metropolitan choices and their town/community choices are served from a generated catalogue bundled with the deployed application. Registration, shop settings and marketplace filtering do not call an external government directory at runtime.

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

Region, district and town use dependent selections. Typing is reserved for the smaller area, street, building, GhanaPost GPS and landmark details. Existing saved district and town values remain visible while a shop completes or corrects its structured location.

## Bundled catalogue

The catalogue is generated from a dated Ghana country snapshot and committed to the repository before release. It contains all 16 regions, hundreds of district-level administrative records and thousands of populated places. Generation fails closed when the source does not provide all 16 regions or returns an obviously incomplete number of districts or towns.

The application normalises provider naming variants and known spelling differences for matching and display. Refreshing the catalogue is a controlled maintenance task: generate a new snapshot, inspect the district and town changes, run the complete validation suite and deploy only after review.

## Shop registration and approval

New shop applications must provide region, district and town/community. The additional address fields improve physical verification and customer discovery.

The structured location is stored separately from the legacy free-text application address. During administrator review, every location level is shown clearly. When the application is approved, a database trigger copies the approved location into the new shop record in the same transaction.

Supplier applications may provide a location but are not forced to complete the full shop hierarchy.

## Shop settings

Shop owners can update the complete business location from Shop Settings. Existing shops may complete their structured location when ready without blocking unrelated settings changes. After a structured location exists, region, district and town are maintained together.

A location update also keeps the legacy shop city and address fields synchronised for receipts and older screens.

## Marketplace search

Marketplace search supports:

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

The location catalogue is read-only application data. No product, stock, order, payment, shop location or historical address record is deleted or rewritten when the catalogue is deployed.
