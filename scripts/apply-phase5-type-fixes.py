from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:80]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/lib/auth.ts",
    "      planTier: true,\n      enabledModules: true,\n",
    "      planTier: true,\n"
    "      businessType: true,\n"
    "      enabledModules: true,\n"
    "      taxRate: true,\n"
    "      receiptHeader: true,\n"
    "      receiptFooter: true,\n"
    "      defaultDepositPercent: true,\n"
    "      productionSetup: true,\n"
    "      onboardingCurrentStep: true,\n"
    "      onboardingCompletedSteps: true,\n"
    "      onboardingStartedAt: true,\n"
    "      onboardingCompletedAt: true,\n",
)

replace_once(
    "src/app/dashboard/setup/page.tsx",
    'module.status === "PLANNED" ? "orange" : "gray"',
    'module.status === "PLANNED" ? "orange" : "neutral"',
)

link_class = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
for href, label in [
    ("/dashboard/subscription", "Review plan and usage"),
    ("/dashboard/staff", "Open staff directory"),
    ("/dashboard/catalog", "Manage items"),
    ("/dashboard/catalog", "Review stock"),
]:
    replace_once(
        "src/app/dashboard/setup/page.tsx",
        f'<Button asChild variant="outline"><Link href="{href}">{label}</Link></Button>',
        f'<Link className="{link_class}" href="{href}">{label}</Link>',
    )

print("Phase 5 focused TypeScript fixes applied.")
