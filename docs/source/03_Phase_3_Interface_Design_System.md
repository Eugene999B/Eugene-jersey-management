# Phase 3 — Complete interface design system

## Release purpose

Phase 3 establishes one shared visual and interaction foundation for Eugene Shop Management. It does not redesign every workflow independently. Instead, it creates reusable controls and safety rules that every current and future module can use without reintroducing inconsistent spacing, unclear selections, hidden actions or mobile overflow.

## Shared visual foundation

The application now has named design tokens for:

- page background and text;
- business primary and secondary colours;
- white, warm and muted surfaces;
- normal and strong borders;
- muted text;
- success, warning, error and information states;
- standard corner radii and panel shadows.

The existing `panel` and `field` classes remain compatible, but now follow the same token system. This changes appearance and accessibility without changing stored business data or route behaviour.

## Reusable components

Phase 3 adds shared components for:

- page heading, description and action areas;
- empty, loading, information, success, warning and error states;
- selected option cards with a strong border, tinted background, checkmark and selected label;
- keyboard-accessible horizontally scrollable table regions;
- confirmation before high-impact form submissions;
- consistent buttons, links, badges and statistic cards.

The components are intentionally generic. They can represent an item, size, customer, payment method, material, machine or later rental option without sports-only language.

## Selection rule

A selected option must never depend only on colour. The shared selection card shows:

1. a two-pixel primary border;
2. a tinted primary background;
3. a visible focus ring;
4. a checkmark;
5. a written `Selected` label;
6. the option title;
7. supporting quantity, price or status detail when supplied;
8. a clear instruction for changing the choice.

Phase 3 applies this rule to customer choice and POS payment methods. Later catalogue and production phases will reuse the same primitive for exact variants, materials and machines.

## Form and touch safety

- Standard fields are at least 44 pixels high.
- Standard buttons are at least 44 pixels high.
- Mobile fields use a 16-pixel font to prevent browser zoom.
- Keyboard focus is visible across links, buttons, fields, summaries and scrollable table regions.
- Disabled and read-only fields are visibly different.
- Invalid fields receive an error border.
- Small-screen layouts keep min-width at zero so long text cannot force the page wider than the viewport.
- Safe-area padding is available for controls near Android and iOS screen edges.

## Tables and overflow

Wide operational tables remain horizontally scrollable inside a named region rather than forcing the whole document to scroll. The region can receive keyboard focus, uses thin scrollbars and contains hover guidance for desktop users. Mobile-specific record cards remain available on workflows that already provide them.

## Destructive action confirmation

Suspending a business can remove staff access. Phase 3 adds an explicit confirmation step to the administrator business directory and business detail page. The confirmation names the business and explains the effect before submission. The server action and audit trail remain authoritative after confirmation.

## Applied screens

The first adoption set includes:

- Customer records;
- customer search selection used by operational forms;
- POS customer and payment-method selection;
- Design Studio header, information and empty state;
- administrator business directory;
- administrator business suspension/reactivation controls.

The shared `panel`, `field`, `Button`, `Badge` and `StatCard` improvements automatically strengthen many additional screens without rewriting their business logic.

## Required responsive verification

Browser acceptance now exercises the same authenticated tenant workflows at:

- 360 × 740 small Android;
- 390 × 844 standard mobile;
- 768 × 1024 tablet;
- 1024 × 768 laptop;
- 1366 × 768 laptop/desktop;
- 1600 × 900 large desktop.

For every size, the tests verify that Customer records and POS remain usable, the document does not exceed the viewport width, fields keep a usable touch height and the selected payment method exposes both semantic and visible selected state.

## Data and deployment safety

Phase 3 has no Prisma migration and does not rewrite shops, products, customers, sales, payments, orders, subscriptions or production records. It is a presentation and interaction-system release. Existing routes, server actions, permissions, tenant isolation and subscription enforcement remain unchanged.
