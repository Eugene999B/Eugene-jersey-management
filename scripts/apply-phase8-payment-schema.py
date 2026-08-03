from pathlib import Path

path = Path("prisma/schema.prisma")
text = path.read_text()

old_fields = '''  amount            Decimal       @db.Decimal(12, 2)
  status            PaymentStatus @default(PENDING)
  providerReference String?
'''
new_fields = '''  amount            Decimal       @db.Decimal(12, 2)
  status            PaymentStatus @default(PENDING)
  tenderedAmount    Decimal?      @db.Decimal(12, 2)
  changeAmount      Decimal       @default(0) @db.Decimal(12, 2)
  metadata          Json          @default("{}")
  providerReference String?
'''

old_indexes = '''  @@index([providerReference])
  @@index([status, verifiedAt])
}

model MediaAsset {
'''
new_indexes = '''  @@index([providerReference])
  @@index([status, verifiedAt])
  @@index([orderId, method, status])
}

model MediaAsset {
'''

for old, new in [(old_fields, new_fields), (old_indexes, new_indexes)]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one schema match, found {count}: {old[:120]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("Phase 8 Payment fields and index applied.")
