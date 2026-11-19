/* eslint-disable @next/next/no-img-element */
export function Logo({ url, className }: { url: string; className?: string }) {
  if (url) return <img src={url} alt="MLPB Cards" className={`h-12 w-auto ${className ?? ""}`} />;
  return (
    <span className={`text-2xl font-black italic tracking-tight ${className ?? ""}`}>
      <span className="text-white">MLPB</span>{" "}
      <span className="bg-gradient-to-r from-brand-amber to-brand bg-clip-text text-transparent">CARDS</span>
    </span>
  );
}
