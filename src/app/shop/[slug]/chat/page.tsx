import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startCustomerChatAction } from "@/app/shop/[slug]/chat/actions";
import { prisma } from "@/lib/db";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sent?: string; error?: string }>;
};

export default async function PublicChatPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const shop = await prisma.shop.findUnique({ where: { slug } });
  if (!shop || !shop.isActive || !shop.storefrontEnabled) notFound();

  const style = {
    "--shop-primary": shop.primaryColor,
    "--shop-secondary": shop.secondaryColor,
  } as React.CSSProperties;

  return (
    <main style={style} className="min-h-screen bg-[#f6f4ef] p-5">
      <section className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[8px] bg-[var(--shop-primary)] p-6 text-white">
          <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={54} height={54} className="rounded-[8px]" />
          <h1 className="mt-6 text-4xl font-semibold">Chat with {shop.name}</h1>
          <p className="mt-3 leading-7 text-white/75">
            Ask about stock, custom jerseys, design files, debt payment, pickup times, or bulk team orders.
          </p>
          <Link className="mt-6 inline-flex rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-slate-950" href={`/shop/${shop.slug}`}>
            Back to shop
          </Link>
        </div>

        <div className="panel p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-[8px] bg-[#f6f4ef] p-3 text-[var(--shop-primary)]">
              <MessageCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-[var(--shop-primary)]">Client portal</p>
              <h2 className="text-2xl font-semibold">Send a message</h2>
            </div>
          </div>
          {query?.sent ? (
            <div className="mb-4 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Message sent. The shop can reply using your phone or email.
            </div>
          ) : null}
          <form action={startCustomerChatAction} className="space-y-3">
            <input type="hidden" name="shopSlug" value={shop.slug} />
            <input className="field" name="name" placeholder="Your name" required />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" name="phone" placeholder="Phone number" />
              <input className="field" name="email" type="email" placeholder="Email" />
            </div>
            <input className="field" name="subject" placeholder="Subject" defaultValue="Order question" required />
            <textarea className="field min-h-40" name="body" placeholder="Write your message" required />
            <Button className="w-full"><Send size={16} /> Send message</Button>
          </form>
        </div>
      </section>
    </main>
  );
}
