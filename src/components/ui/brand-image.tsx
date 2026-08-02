import Image from "next/image";

const DEFAULT_BRAND_IMAGE = "/brand/esm-mark.svg";

type BrandImageProps = {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

function safeSource(value?: string | null) {
  const source = value?.trim();
  if (!source) return DEFAULT_BRAND_IMAGE;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    return url.protocol === "https:" ? url.toString() : DEFAULT_BRAND_IMAGE;
  } catch {
    return DEFAULT_BRAND_IMAGE;
  }
}

export function BrandImage({ src, alt, width, height, className, priority = false }: BrandImageProps) {
  const source = safeSource(src);
  if (source.startsWith("/")) {
    return <Image src={source} alt={alt} width={width} height={height} className={className} priority={priority} />;
  }

  // Remote tenant logos are already optimized and served from the configured
  // durable media host. Rendering them directly avoids turning Next's image
  // optimizer into an open remote fetcher.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt={alt} width={width} height={height} className={className} loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />;
}
