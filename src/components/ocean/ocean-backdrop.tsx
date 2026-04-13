import { cn } from "@/lib/utils";

export function OceanBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn("ocean-backdrop", className)} aria-hidden="true" data-testid="ocean-backdrop">
      <div className="ocean-fog ocean-fog-1" />
      <div className="ocean-fog ocean-fog-2" />
      <div className="ocean-scan" />
    </div>
  );
}
