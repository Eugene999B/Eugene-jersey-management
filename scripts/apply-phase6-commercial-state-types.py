from pathlib import Path

path = Path("src/lib/subscription-hardening.ts")
text = path.read_text()

replacements = [
    (
        "async function commercialStateFromDb(db: SubscriptionDb, shopId: string, now = new Date()) {",
        "async function commercialStateFromDb(db: SubscriptionDb, shopId: string, now = new Date()): Promise<CommercialSubscriptionState> {",
    ),
    (
        "    const suspended = accessGrant.accessType === SubscriptionAccessType.SUSPENDED;\n    const label = accessTypeLabel(accessGrant.accessType);\n    return {",
        "    const suspended = accessGrant.accessType === SubscriptionAccessType.SUSPENDED;\n    const label = accessTypeLabel(accessGrant.accessType);\n    const blockCode: SubscriptionBlockCode | null = suspended ? \"SUBSCRIPTION_SUSPENDED\" : null;\n    const state: CommercialSubscriptionState = {",
    ),
    (
        '      blockCode: suspended ? "SUBSCRIPTION_SUSPENDED" : null,',
        "      blockCode,",
    ),
    (
        "        reason: accessGrant.reason,\n      },\n    };\n  }\n\n  let snapshot",
        "        reason: accessGrant.reason,\n      },\n    };\n    return state;\n  }\n\n  let snapshot",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match, found {count}: {old[:100]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("Phase 6 commercial state types fixed.")
