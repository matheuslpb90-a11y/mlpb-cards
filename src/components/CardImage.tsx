/* eslint-disable @next/next/no-img-element */
export function CardImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src)
    return (
      <div className={`flex aspect-[63/88] items-center justify-center rounded-lg bg-gradient-to-br from-brand-light to-slate-100 text-4xl ${className ?? ""}`}>
        🃏
      </div>
    );
  return <img src={src} alt={alt} loading="lazy" className={`aspect-[63/88] w-full rounded-lg object-cover ${className ?? ""}`} />;
}
