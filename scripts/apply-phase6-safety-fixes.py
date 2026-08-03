from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/app/admin/access/actions.ts",
    "function requiresEndDate(type: SubscriptionAccessType) {\n  return [\n    SubscriptionAccessType.FREE_TRIAL,\n    SubscriptionAccessType.SPONSORED,\n    SubscriptionAccessType.PROMOTIONAL,\n    SubscriptionAccessType.EMERGENCY,\n  ].includes(type);\n}\n",
    "const temporaryAccessTypes = new Set<SubscriptionAccessType>([\n  SubscriptionAccessType.FREE_TRIAL,\n  SubscriptionAccessType.SPONSORED,\n  SubscriptionAccessType.PROMOTIONAL,\n  SubscriptionAccessType.EMERGENCY,\n]);\n\nconst invoiceFreeAccessTypes = new Set<SubscriptionAccessType>([\n  SubscriptionAccessType.FREE_TRIAL,\n  SubscriptionAccessType.SPONSORED,\n  SubscriptionAccessType.FREE_FOREVER,\n  SubscriptionAccessType.EMERGENCY,\n  SubscriptionAccessType.SUSPENDED,\n]);\n\nfunction requiresEndDate(type: SubscriptionAccessType) {\n  return temporaryAccessTypes.has(type);\n}\n",
)
replace_once(
    "src/app/admin/access/actions.ts",
    "  const input = parsed.data;\n  if (requiresEndDate(input.accessType) && !input.endsAt) accessRedirect(\"end-required\");\n",
    "  const input = parsed.data;\n  const now = new Date();\n  if (input.startsAt.getTime() > now.getTime()) accessRedirect(\"future-start\");\n  if (requiresEndDate(input.accessType) && !input.endsAt) accessRedirect(\"end-required\");\n",
)
replace_once(
    "src/app/admin/access/actions.ts",
    "  const freeLike = [\n    SubscriptionAccessType.FREE_TRIAL,\n    SubscriptionAccessType.SPONSORED,\n    SubscriptionAccessType.FREE_FOREVER,\n    SubscriptionAccessType.EMERGENCY,\n    SubscriptionAccessType.SUSPENDED,\n  ].includes(input.accessType);\n  const invoicesDisabled = freeLike ? true : input.invoicesDisabled;\n",
    "  const invoicesDisabled = invoiceFreeAccessTypes.has(input.accessType) ? true : input.invoicesDisabled;\n",
)
replace_once(
    "src/app/admin/access/actions.ts",
    "          revokedAt: new Date(),\n",
    "          revokedAt: now,\n",
)
replace_once(
    "src/app/admin/access/actions.ts",
    "          voidedAt: new Date(),\n",
    "          voidedAt: now,\n",
)
replace_once(
    "src/app/admin/access/actions.ts",
    "  await prisma.shopAccessGrant.update({\n    where: { id: grant.id },\n    data: {\n      isActive: false,\n      revokedAt: new Date(),\n      revokedById: session.id,\n      revocationReason: parsed.data.reason,\n    },\n  });\n",
    "  const revokedAt = new Date();\n  await prisma.$transaction(async (tx) => {\n    await tx.shopAccessGrant.update({\n      where: { id: grant.id },\n      data: {\n        isActive: false,\n        revokedAt,\n        revokedById: session.id,\n        revocationReason: parsed.data.reason,\n      },\n    });\n    await tx.shop.update({\n      where: { id: grant.shopId },\n      data: { subscriptionStatus: SubscriptionStatus.SUSPENDED },\n    });\n    await tx.shopSubscriptionContract.updateMany({\n      where: { shopId: grant.shopId },\n      data: { subscriptionStatus: SubscriptionStatus.SUSPENDED },\n    });\n  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });\n",
)

replace_once(
    "src/app/admin/access/page.tsx",
    '  "end-required": "This temporary access type requires an end date.",\n',
    '  "end-required": "This temporary access type requires an end date.",\n  "future-start": "Access grants apply immediately; choose today or an earlier start date.",\n',
)
replace_once(
    "src/app/admin/access/page.tsx",
    'Underlying contract will remain and must be reviewed.',
    'Commercial access will be suspended until a new grant or paid contract is assigned.',
)
replace_once(
    "src/app/admin/access/page.tsx",
    'Access grant revoked. Assign or review the underlying subscription contract before relying on commercial access.',
    'Access grant revoked. Commercial actions are suspended until a new grant or paid contract is assigned.',
)

replace_once(
    "src/tests/phase6-admin-access.test.ts",
    '    expect(actions).toContain("Superseded by a new");\n',
    '    expect(actions).toContain("Superseded by a new");\n    expect(actions).toContain("temporaryAccessTypes");\n    expect(actions).toContain("PROMOTIONAL");\n    expect(actions).toContain("future-start");\n',
)
replace_once(
    "src/tests/phase6-admin-access.test.ts",
    '    expect(actions).toContain("nextReminderAt: null");\n',
    '    expect(actions).toContain("nextReminderAt: null");\n    expect(actions).toContain("subscriptionStatus: SubscriptionStatus.SUSPENDED");\n',
)

print("Phase 6 fail-closed safety fixes applied.")
