from pathlib import Path

path = Path("src/components/pos/pos-terminal.tsx")
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one POS match, found {count}: {old[:160]!r}")
    text = text.replace(old, new, 1)


replace_once(
    'import { SelectionCard } from "@/components/ui/selection-card";\nimport { currency } from "@/lib/format";\n',
    'import { SelectionCard } from "@/components/ui/selection-card";\nimport { ProductOptionSelector } from "@/components/pos/product-option-selector";\nimport { currency } from "@/lib/format";\nimport { variantOptionLabel } from "@/lib/catalog-options";\n',
)
replace_once(
    '''type PosProduct = {
  id: string;
  name: string;
  category: string;
''',
    '''type PosProduct = {
  id: string;
  name: string;
  itemType: string;
  category: string;
''',
)
replace_once(
    '''  sku: string;
  quantity: number;
''',
    '''  sku: string;
  optionLabel: string;
  quantity: number;
''',
)
replace_once(
    '  const [personalizing, setPersonalizing] = useState<{ product: PosProduct; variant: PosVariant } | null>(null);\n',
    '  const [personalizing, setPersonalizing] = useState<{ product: PosProduct; variant: PosVariant } | null>(null);\n  const [selectingOptions, setSelectingOptions] = useState<PosProduct | null>(null);\n',
)
replace_once(
    '''        variantId: variant.id,
        sku: variant.sku,
        quantity: 1,
''',
    '''        variantId: variant.id,
        sku: variant.sku,
        optionLabel: variantOptionLabel(variant.attributes),
        quantity: 1,
''',
)
replace_once(
    '''  function showCart() {
    document.getElementById("pos-cart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
''',
    '''  function chooseVariant(product: PosProduct, variant: PosVariant) {
    setSelectingOptions(null);
    if (!product.isService && variant.stockQty <= 0) {
      setMessage(`${product.name} — ${variantOptionLabel(variant.attributes)} is unavailable.`);
      return;
    }
    if (product.isPersonalizable) setPersonalizing({ product, variant });
    else addLine(product, variant);
  }

  function chooseProduct(product: PosProduct) {
    setMessage(null);
    if (product.variants.length > 1) {
      setSelectingOptions(product);
      return;
    }
    const variant = product.variants[0];
    if (variant) chooseVariant(product, variant);
  }

  function productPrice(product: PosProduct) {
    const prices = product.variants.map((variant) => variant.price);
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    return minimum === maximum ? currency(minimum, currencyCode) : `${currency(minimum, currencyCode)} – ${currency(maximum, currencyCode)}`;
  }

  function showCart() {
    document.getElementById("pos-cart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
''',
)

old_grid = '''          {filtered.map((product) => {
            const variant = product.variants[0];
            return (
              <button
                type="button"
                key={product.id}
                className="min-w-0 rounded-lg border border-[#ded8cd] bg-white p-3 text-left transition hover:border-[var(--shop-primary)] hover:shadow-md sm:min-h-40 sm:p-4"
                onClick={() => {
                  if (!variant) return;
                  if (product.isPersonalizable) setPersonalizing({ product, variant });
                  else addLine(product, variant);
                }}
              >
                {product.imageUrl ? (
                  <div
                    aria-label={product.name}
                    className="mb-2 aspect-[4/3] rounded-lg bg-cover bg-center sm:mb-3"
                    role="img"
                    style={{ backgroundImage: `url(${product.imageUrl})` }}
                  />
                ) : null}
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2 sm:mb-4 sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-semibold text-slate-950 sm:text-base">{product.name}</h2>
                    <p className="truncate text-xs text-slate-500 sm:text-sm">{product.category}</p>
                  </div>
                  <span className="shrink-0">{product.isService ? <Badge tone="orange">Service</Badge> : <Badge tone={variant?.stockQty ? "green" : "red"}>{variant?.stockQty ?? 0}</Badge>}</span>
                </div>
                <p className="text-base font-semibold sm:text-2xl">{currency(variant?.price ?? product.basePrice, currencyCode)}</p>
                <p className="mt-1 truncate text-xs text-slate-500 sm:mt-3 sm:text-sm">{variant?.sku ?? "No variant"}</p>
              </button>
            );
          })}
'''
new_grid = '''          {filtered.map((product) => {
            const availableCount = product.variants.filter((variant) => product.isService || variant.stockQty > 0).length;
            const totalStock = product.isService ? null : product.variants.reduce((sum, variant) => sum + variant.stockQty, 0);
            return (
              <button
                type="button"
                key={product.id}
                className="min-w-0 rounded-lg border border-[#ded8cd] bg-white p-3 text-left transition hover:border-[var(--shop-primary)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-40 sm:p-4"
                onClick={() => chooseProduct(product)}
                disabled={!availableCount}
                aria-label={product.variants.length > 1 ? `Choose option for ${product.name}` : `Add ${product.name}`}
              >
                {product.imageUrl ? (
                  <div aria-label={product.name} className="mb-2 aspect-[4/3] rounded-lg bg-cover bg-center sm:mb-3" role="img" style={{ backgroundImage: `url(${product.imageUrl})` }} />
                ) : null}
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2 sm:mb-4 sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-semibold text-slate-950 sm:text-base">{product.name}</h2>
                    <p className="truncate text-xs text-slate-500 sm:text-sm">{product.category} · {product.itemType}</p>
                  </div>
                  <span className="shrink-0">{product.isService ? <Badge tone="orange">Service</Badge> : <Badge tone={totalStock ? "green" : "red"}>{totalStock ?? 0}</Badge>}</span>
                </div>
                <p className="text-base font-semibold sm:text-2xl">{productPrice(product)}</p>
                <p className="mt-1 text-xs font-semibold text-cyan-700 sm:mt-3 sm:text-sm">{product.variants.length > 1 ? `${product.variants.length} options · choose exact option` : variantOptionLabel(product.variants[0]?.attributes)}</p>
              </button>
            );
          })}
'''
replace_once(old_grid, new_grid)
replace_once(
    '''                  <p className="truncate font-semibold">{line.productName}</p>
                  <p className="break-all text-sm text-slate-500">{line.sku}</p>
''',
    '''                  <p className="truncate font-semibold">{line.productName}</p>
                  <p className="mt-0.5 text-xs font-bold text-cyan-700">{line.optionLabel}</p>
                  <p className="break-all text-xs text-slate-500">{line.sku}</p>
''',
)
replace_once(
    '''      {personalizing ? <PersonalizationModal product={personalizing.product} onClose={() => setPersonalizing(null)} onSave={(data) => { addLine(personalizing.product, personalizing.variant, data); setPersonalizing(null); }} /> : null}
''',
    '''      {selectingOptions ? <ProductOptionSelector product={selectingOptions} currencyCode={currencyCode} onClose={() => setSelectingOptions(null)} onConfirm={(variant) => chooseVariant(selectingOptions, variant)} /> : null}
      {personalizing ? <PersonalizationModal product={personalizing.product} onClose={() => setPersonalizing(null)} onSave={(data) => { addLine(personalizing.product, personalizing.variant, data); setPersonalizing(null); }} /> : null}
''',
)

path.write_text(text)
print("Phase 7 POS exact-option selector applied.")
