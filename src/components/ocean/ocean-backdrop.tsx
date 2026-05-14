import { cn } from "@/lib/utils";

export function OceanBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn("fixed inset-0 z-0 pointer-events-none overflow-hidden bg-gradient-to-b from-[#e0f2fe] to-[#bae6fd]", className)} aria-hidden="true" data-testid="ocean-backdrop">

      {/* Grid overlay for technical feel */}
      <div
        className="ocean-grid absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(#0284c7 1px, transparent 1px), linear-gradient(90deg, #0284c7 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Surface light glare */}
      <div className="ocean-surface-glare absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-gradient-to-br from-white/80 to-transparent rounded-full blur-[120px]" />
    </div>
  );
}
