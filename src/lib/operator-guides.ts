import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
};

export type OperatorGuide = {
  title: string;
  subtitle: string;
  sections: GuideSection[];
};

const designStudioGuide: OperatorGuide = {
  title: "EJM Design Studio Quick Operating Guide",
  subtitle: "A practical guide for shop owners, managers and designers preparing production artwork.",
  sections: [
    { heading: "Before starting", steps: [
      "Open Design Studio from the shop dashboard.",
      "Confirm the correct machine profile, material width and material height.",
      "Download a project backup before major production changes.",
    ] },
    { heading: "Add and arrange artwork", steps: [
      "Add text, shapes or approved artwork using the studio tools.",
      "Click a layer to select it. Hold the modifier key to select more than one layer.",
      "Drag selected artwork or use the exact millimetre fields for accurate placement.",
      "Use corner handles to resize one unlocked layer and the rotation handle to rotate it.",
      "Hold Shift while rotating to snap to 15-degree steps. Images and text keep their proportions automatically.",
    ] },
    { heading: "Groups, layers and mobile inspector", steps: [
      "Group related layers so they move together without changing their spacing.",
      "Lock completed layers to prevent accidental movement.",
      "On phones and tablets, open Inspector to edit the same exact dimensions and positions used on desktop.",
    ] },
    { heading: "Save, recovery and history", steps: [
      "Save the project to the shop database after meaningful changes.",
      "Every successful save creates an immutable version in project history.",
      "After an interrupted browser session, restore the recovery draft only when it is the work you recognise.",
      "Opening an older version creates a working copy; it does not overwrite the current project until you save.",
    ] },
    { heading: "Production export", steps: [
      "Select the shop machine profile that matches the cutter or RIP workflow.",
      "Use full-colour SVG or print output for artwork workflows.",
      "Use cutter output only when the production check reports no blocked layers.",
      "Live text, raster images, external artwork and unsupported SVG elements must be converted to supported vector paths before HPGL, PLT or DXF export.",
      "Never ignore an out-of-sheet or unsupported-artwork warning; correct the design first.",
    ] },
    { heading: "Common problems", steps: [
      "Nothing moves: check whether the layer is locked or hidden.",
      "Cutter export is blocked: read the listed layer warning and convert or remove unsupported content.",
      "Wrong output size: confirm material dimensions, machine bed size and exact millimetre fields.",
      "Work disappeared after a reload: check the recovery prompt and project version history.",
    ] },
  ],
};

const adminSections: Record<string, GuideSection> = {
  overview: { heading: "Command centre", paragraphs: ["The command centre summarises shops, users, buyers, orders, sales, debt, recurring subscription estimates and the support queue."], steps: ["Review the support queue and past-due shops first.", "Use the page cards to enter each specialised control area.", "Download reports or page guides before performing unfamiliar actions."] },
  shops: { heading: "Shops", paragraphs: ["A registered shop can have an active private workspace while choosing to keep its public storefront offline. Registration, verification, storefront visibility and ordering are separate states."], steps: ["Create the shop and owner account from a configured saved plan.", "Give the owner their Login ID and password through a secure channel.", "Verify business credentials before the shop becomes eligible for the marketplace.", "The shop owner controls Online, Browse-only or Offline status from Shop Settings.", "Use Suspend only to block the private workspace; do not suspend a shop merely because it chose to go offline."] },
  applications: { heading: "Business applications", paragraphs: ["Public shop and supplier submissions remain private until reviewed. Submission alone never creates a tenant, Login ID, supplier portal or payment route."], steps: ["Search the application queue by reference, business or contact.", "Start the review to record the assigned administrator.", "Request changes or reject with an applicant-facing reason when information is incomplete or unsuitable.", "Approve a shop only with a configured active plan, unique Login ID and temporary credential delivered through a separate secure channel.", "Approve a supplier only under the exact reviewed active shop relationship.", "After shop approval, complete business verification and Paystack routing separately before public launch."] },
  investigation: { heading: "Investigation search and support profiles", paragraphs: ["Investigation pages collect read-only operational evidence without impersonating a tenant or displaying provider secrets, passwords, sessions, two-factor secrets or full settlement account numbers."], steps: ["Search by shop, Login ID, email, phone, receipt, provider reference or audit action.", "Open the exact-shop profile and review workspace, verification, subscription, users, failed messages, failed payments, delayed orders and audit events.", "Open a durable support case when the issue needs assignment, evidence and a recorded resolution.", "Use existing audited shop controls for suspension, verification or payment-routing changes."] },
  billing: { heading: "Subscriptions and billing", paragraphs: ["The sole authenticated platform administrator saves plan changes immediately. Every save keeps a reason, before/after history record and immutable version."], steps: ["Edit the plan terms and explain the reason.", "Select Save changes now.", "Reassign a plan to a tenant only when that tenant should receive the new version and price.", "Catalogue edits never silently reprice existing tenant contracts."] },
  communications: { heading: "Communication credits", paragraphs: ["SMS and WhatsApp packages are paid to the EJM administrator Paystack account. Each shop has isolated channel balances."], steps: ["Create an inactive package shell when a new package is needed.", "Enter the price, paid units, bonus units and availability, then save immediately.", "Confirm a controlled Paystack purchase credits the wallet exactly once.", "Review wallet usage, refunds and provider failures through the ledger."] },
  staff: { heading: "Administrator staff", paragraphs: ["Platform administrator staff accounts receive only the responsibilities assigned to them. An unrestricted administrator can access every main-admin page."], steps: ["Create only the access needed for the person’s job.", "Disable access immediately when a worker leaves.", "Never share the unrestricted administrator password."] },
  support: { heading: "Support desk and durable cases", steps: ["Review open returns, customer conversations, failed messages and delayed orders.", "Use Investigation to find the exact shop, user, order, payment, message or audit evidence.", "Open a support case for issues requiring assignment, priority, append-only notes and a resolution.", "Corrections are added as new notes; existing case notes are not edited or deleted.", "Use existing audited actions for business changes; a case does not itself impersonate a tenant, refund a payment or alter stock."] },
  broadcast: { heading: "Broadcast", steps: ["Use global announcements only for messages every tenant should see.", "Keep messages short and operational.", "Avoid placing passwords, API keys or private customer data in announcements."] },
  activity: { heading: "Activity logs", steps: ["Search by action, shop or administrator when investigating a change.", "Use timestamps and entity IDs to follow related records.", "Activity logs are evidence; do not treat them as editable business records."] },
  security: { heading: "Security", steps: ["Review failed sign-ins and locked accounts.", "Keep personal two-factor authentication enabled on the main administrator account.", "Use account security to rotate recovery codes and revoke sessions when needed."] },
  integrations: { heading: "Integration health", steps: ["Check PostgreSQL, Paystack, messaging, storage and scheduler health.", "Health checks are read-only and do not send messages or create payments.", "Complete controlled provider tests before enabling broad customer use."] },
  settings: { heading: "Platform settings", steps: ["Maintain public platform identity, support, legal, marketplace and security policies.", "Do not store provider secrets in ordinary settings fields.", "Record a clear reason for sensitive platform policy changes."] },
  suppliers: { heading: "How shops and suppliers operate", paragraphs: ["Shops create supplier records, prepare supplier orders and may grant a supplier portal account. Suppliers see only the records assigned to their portal."], steps: ["The shop creates the supplier and contact details.", "The shop prepares supplier orders and tracks expected delivery.", "Portal access is invited only when the supplier should sign in directly.", "The shop verifies received quantities before updating stock and payments."] },
  shopOperations: { heading: "How shop teams operate", steps: ["Owners and managers configure the shop, staff, online status, payment methods and production settings.", "Cashiers use POS, select or create customers and record cash, card, mobile-money or credit sales.", "Each credit sale creates a separate debt entry; the customer’s outstanding total is the sum of unpaid entries.", "Designers use the Design Studio and shop machine profiles.", "Shop teams use Messages, reports, closing and audit tools according to their assigned role."] },
};

export function adminPageGuide(pathname: string): OperatorGuide {
  const key = pathname.startsWith("/admin/applications") ? "applications"
    : pathname.startsWith("/admin/investigate") ? "investigation"
      : pathname.startsWith("/admin/shops") ? "shops"
        : pathname.startsWith("/admin/billing/communications") ? "communications"
          : pathname.startsWith("/admin/billing") ? "billing"
            : pathname.startsWith("/admin/staff") ? "staff"
              : pathname.startsWith("/admin/support") ? "support"
                : pathname.startsWith("/admin/broadcast") ? "broadcast"
                  : pathname.startsWith("/admin/activity") ? "activity"
                    : pathname.startsWith("/admin/security") ? "security"
                      : pathname.startsWith("/admin/integrations") ? "integrations"
                        : pathname.startsWith("/admin/settings") ? "settings"
                          : "overview";
  const section = adminSections[key];
  return {
    title: `EJM Administrator Page Guide - ${section.heading}`,
    subtitle: `Help for ${pathname}. This guide is restricted to the unrestricted platform administrator.`,
    sections: [section, { heading: "Safe operating rule", paragraphs: ["Confirm the affected shop, amount, status and business reason before saving. Sensitive actions remain audited and versioned immediately after you save."] }],
  };
}

export const adminHandbook: OperatorGuide = {
  title: "EJM Complete Administrator and Operations Handbook",
  subtitle: "How the main administrator, shops, staff and suppliers use Eugene Jersey Management.",
  sections: [
    adminSections.overview,
    adminSections.shops,
    adminSections.applications,
    adminSections.investigation,
    adminSections.billing,
    adminSections.communications,
    adminSections.staff,
    adminSections.support,
    adminSections.broadcast,
    adminSections.activity,
    adminSections.security,
    adminSections.integrations,
    adminSections.settings,
    adminSections.shopOperations,
    adminSections.suppliers,
    { heading: "Daily administrator checklist", steps: ["Review support cases and live operational queues.", "Review new business applications and past-due or suspended shops.", "Confirm integrations are healthy before controlled provider tests.", "Review recent high-impact audit events.", "Back up or export important records before structural changes."] },
    { heading: "Important boundaries", steps: ["Shop customer payments settle to the shop’s Paystack subaccount; communication-credit purchases settle to the EJM administrator account.", "A shop being offline is a voluntary marketplace choice and does not mean the registered workspace is suspended.", "Public application approval does not configure Paystack, verify business credentials or activate public ordering automatically.", "Never ask a user to send passwords, secret keys or full settlement account numbers through ordinary chat or notes.", "Use GitHub validation and Railway deployment status as the production source of truth."] },
  ],
};

export function designGuide() {
  return designStudioGuide;
}

function textParagraph(text: string) {
  return new Paragraph({ children: [new TextRun({ text, size: 22 })], spacing: { after: 120 } });
}

export async function buildGuideDocx(guide: OperatorGuide) {
  const children: Paragraph[] = [
    new Paragraph({ text: guide.title, heading: HeadingLevel.TITLE }),
    textParagraph(guide.subtitle),
    textParagraph(`Generated by Eugene Jersey Management on ${new Date().toLocaleDateString("en-GB", { timeZone: "Africa/Accra" })}.`),
  ];
  for (const section of guide.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
    for (const paragraph of section.paragraphs ?? []) children.push(textParagraph(paragraph));
    for (const step of section.steps ?? []) children.push(new Paragraph({ text: step, bullet: { level: 0 }, spacing: { after: 80 } }));
  }
  const document = new Document({
    creator: "Eugene Jersey Management",
    title: guide.title,
    sections: [{ children }],
  });
  return Packer.toBuffer(document);
}
