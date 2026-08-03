from pathlib import Path

path = Path("scripts/seed-e2e.ts")
text = path.read_text()

identity_old = '''  unrestrictedAdmin: {
    email: "browser-admin@ejm.test",
    loginId: "EJM-E2E-ADMIN",
    name: "EJM Browser Administrator",
  },
  supportWorker: {
'''
identity_new = '''  unrestrictedAdmin: {
    email: "browser-admin@ejm.test",
    loginId: "EJM-E2E-ADMIN",
    name: "EJM Browser Administrator",
  },
  accessAdministrator: {
    email: "browser-access-admin@ejm.test",
    loginId: "EJM-E2E-ACCESS",
    name: "EJM Browser Access Administrator",
  },
  supportWorker: {
'''

upsert_anchor = '''  await prisma.user.upsert({
    where: { email: identities.supportWorker.email },
'''
upsert_insert = '''  await prisma.user.upsert({
    where: { email: identities.accessAdministrator.email },
    update: {
      adminLoginId: identities.accessAdministrator.loginId,
      name: identities.accessAdministrator.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      shopId: null,
      adminPermissions: ["billing"],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      adminLoginId: identities.accessAdministrator.loginId,
      email: identities.accessAdministrator.email,
      name: identities.accessAdministrator.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      adminPermissions: ["billing"],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: identities.supportWorker.email },
'''

for old, new in [(identity_old, identity_new), (upsert_anchor, upsert_insert)]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match, found {count}: {old[:100]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("Dedicated billing administrator seeded for Phase 6 browser tests.")
