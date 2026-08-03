from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/lib/tenant-db.ts",
    '  "ShopPaymentConfig",\n  "AuditLog",\n',
    '  "ShopPaymentConfig",\n  "ShopLocation",\n  "AuditLog",\n',
)
replace_once(
    "src/lib/tenant-db.ts",
    '  shopPaymentConfig: "ShopPaymentConfig",\n  auditLog: "AuditLog",\n',
    '  shopPaymentConfig: "ShopPaymentConfig",\n  shopLocation: "ShopLocation",\n  auditLog: "AuditLog",\n',
)

replace_once(
    "src/app/dashboard/setup/actions.ts",
    'import { platformDb } from "@/lib/platform-db";\n',
    '',
)
replace_once(
    "src/app/dashboard/setup/actions.ts",
    '  await platformDb.$transaction(async (tx) => {\n',
    '  await prisma.$transaction(async (tx) => {\n',
)
replace_once(
    "src/app/dashboard/setup/actions.ts",
    '    platformDb.shopLocation.findUnique({ where: { shopId }, select: { id: true } }),\n',
    '    prisma.shopLocation.findUnique({ where: { shopId }, select: { id: true } }),\n',
)

replace_once(
    "src/app/dashboard/setup/page.tsx",
    'import { platformDb } from "@/lib/platform-db";\n',
    '',
)
replace_once(
    "src/app/dashboard/setup/page.tsx",
    '    platformDb.shopLocation.findUnique({ where: { shopId: shop.id } }),\n',
    '    prisma.shopLocation.findUnique({ where: { shopId: shop.id } }),\n',
)

print("Phase 5 tenant-scoped location access applied.")
