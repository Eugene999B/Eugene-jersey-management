# Release #26 — Admin Investigation, Support Cases, and Business Applications

Updated: 2026-07-28

## Confirmed roadmap phase

This release implements the next confirmed roadmap work after CEO Settings, subscription plans, communication credits, and the solo-administrator/operator-help release:

1. Admin Investigation and Support Command Centre.
2. Public Shop and Supplier Registration.

The existing `/admin/support` page remains the operational queue for returns, unresolved customer conversations, delayed orders, and failed messages. Release #26 adds durable investigation cases and public business applications rather than replacing those existing workflows.

## Objectives

### Administrator investigation centre

- Search shops, shop owners, workers, suppliers, orders, payments, messages, and audit activity from one administrator surface.
- Open a support profile for one exact shop without impersonating a tenant user.
- Create durable support cases with a reference number, category, priority, status, summary, and assigned administrator.
- Add immutable case notes and record every case transition in the platform audit log.
- Link a case to a shop, user, supplier, order, payment, customer thread, or provider event without copying secrets into the case.
- Display read-only operational evidence such as account status, verification state, recent logins, subscription status, failed messages, payment failures, delayed orders, and recent audited actions.
- Reuse existing audited shop suspension/reactivation and credential verification controls.
- Never expose provider secrets, full settlement account numbers, password hashes, session tokens, two-factor secrets, or another tenant’s unrestricted records.

### Public shop and supplier applications

- Add public application forms for prospective shops and suppliers.
- Give each accepted submission a public reference and a private administrator review record.
- Store business identity, contact, location, category, requested services, and consent declarations.
- Allow applicants to upload only approved business-evidence documents through the existing media/storage boundary.
- Prevent duplicate open applications by normalised email, phone, and business-registration identifiers where available.
- Allow administrators with the Shops permission to review, request changes, accept, or reject applications with a written reason.
- On acceptance, create the approved business records through reviewed server-side transactions instead of allowing arbitrary client-side IDs or prices.
- Shop acceptance must use a configured active subscription plan and create the authenticating owner Login ID on the owner user account.
- Supplier acceptance must attach the supplier to an exact approved shop relationship or create a platform supplier applicant record according to the final reviewed workflow; it must not silently grant cross-tenant access.

## Proposed data model

### SupportCase

- `id`
- `reference` — unique human-readable case number
- `shopId?`
- `subjectUserId?`
- `supplierId?`
- `assignedToId?`
- `category`
- `priority`
- `status`
- `title`
- `summary`
- `resolution?`
- `linkedEntityType?`
- `linkedEntityId?`
- `openedById`
- `resolvedAt?`
- timestamps

### SupportCaseNote

- `id`
- `caseId`
- `authorId`
- `body`
- `isInternal`
- timestamp

Case notes are append-only. Corrections are added as a new note; existing notes are not edited or deleted through ordinary administrator workflows.

### BusinessApplication

- `id`
- `reference`
- `type` — shop or supplier
- `status`
- business identity and registration fields
- contact fields
- location fields
- requested category/services
- supporting-document references
- applicant declarations and consent timestamp
- assigned reviewer
- review notes and decision reason
- accepted shop/user/supplier references where applicable
- timestamps

## Access and isolation rules

1. Unrestricted platform administrators may access all Release #26 administrator surfaces.
2. Restricted platform workers require the existing `support` permission for investigation cases and the existing `shops` permission for business applications and acceptance decisions.
3. Shop users cannot query support cases, application review records, platform notes, or administrator-only evidence through normal or interactive tenant clients.
4. Public applicants may create an application and check only the status of their own application using a separate reference-plus-verification flow; they receive no administrator notes or internal identifiers.
5. Investigation is read-only unless an existing dedicated audited action is explicitly invoked.
6. No impersonation or silent tenant-session creation is introduced.
7. Every case creation, assignment, status change, note, application decision, and accepted-account creation is audited.
8. Existing shop prices and contracts are never changed by an investigation action or application review.

## Administrator routes

- `/admin/support` — command-centre overview and current operational queues.
- `/admin/support/cases` — searchable case register.
- `/admin/support/cases/new` — create a case from an investigation subject.
- `/admin/support/cases/[caseId]` — evidence, notes, assignment, status, and resolution.
- `/admin/investigate` — cross-entity search and shop support profiles.
- `/admin/investigate/shops/[shopId]` — exact-shop investigation profile.
- `/admin/applications` — shop and supplier application queue.
- `/admin/applications/[applicationId]` — review and decision workspace.

## Public routes

- `/apply` — choose shop or supplier application.
- `/apply/shop`
- `/apply/supplier`
- `/apply/status`

## Delivery sequence

### Slice A — foundation

- Prisma enums, models, migration, relations, and tenant-client deny list.
- Release documentation and validation checklist.
- Case/application reference generators and validation schemas.
- Unit and tenant-isolation tests for the new platform-global records.

### Slice B — investigation and support cases

- Cross-entity administrator search.
- Exact-shop investigation profile.
- Case register, create flow, notes, assignment, transitions, and audit history.
- Desktop and 390 × 844 mobile browser journeys.

### Slice C — public business applications

- Public shop and supplier forms.
- Duplicate and abuse protection.
- Application status lookup.
- Administrator review queue and decision workflow.
- Controlled accepted-record creation with plan/Login-ID rules.

### Slice D — completion

- Administrator help-guide updates.
- Documentation generation.
- Dependency audit, Prisma generation/migration, lifecycle guards, lint, TypeScript, complete unit suite, tenant-isolation attacks, production build, and Chromium acceptance.
- Merge only the exact green candidate, then verify Railway deployment.

## Explicit exclusions

- No provider secrets or secret-management UI.
- No administrator impersonation.
- No broad paid onboarding until the separate real Paystack, Arkesel, WhatsApp, storage, and scheduler checks are completed.
- No Paystack refunds or settlement-reconciliation implementation in this release.
- No nearby-shop coordinate search in this release.
- No automatic subscription renewal, invoicing, or dunning in this release.

## Completion conditions

Release #26 is complete only when:

- case records and notes are durable and audited;
- restricted administrator permissions are enforced;
- tenant clients cannot access platform support/application models;
- public applications cannot expose internal review data;
- accepted shop accounts use a configured plan and authenticating Login ID;
- accepted supplier access is attached to an explicit tenant relationship;
- all required CI and browser checks pass;
- the exact validated pull request is merged and Railway reports a successful deployment.
