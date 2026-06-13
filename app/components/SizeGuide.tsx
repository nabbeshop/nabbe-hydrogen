import { useEffect } from 'react';

export function SizeGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />

      {/* Modal Card */}
      <div className="relative bg-card border border-border w-full max-w-lg p-6 shadow-2xl z-10 flex flex-col gap-6 animate-scale-up">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-display text-2xl text-foreground">Size Guide</h2>
            <p className="font-body text-xs text-muted-foreground mt-1">
              Measurements in inches. Fit is relaxed/oversized.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground text-xl p-1 font-mono transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Sizing Table */}
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 pr-4 font-body font-medium uppercase tracking-wider text-muted-foreground">
                  Size
                </th>
                <th className="py-3 px-4 font-body font-medium uppercase tracking-wider text-muted-foreground">
                  Chest (in)
                </th>
                <th className="py-3 px-4 font-body font-medium uppercase tracking-wider text-muted-foreground">
                  Length (in)
                </th>
                <th className="py-3 pl-4 font-body font-medium uppercase tracking-wider text-muted-foreground">
                  Shoulder (in)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium text-foreground">S</td>
                <td className="py-3 px-4 text-muted-foreground">42</td>
                <td className="py-3 px-4 text-muted-foreground">27.5</td>
                <td className="py-3 pl-4 text-muted-foreground">19</td>
              </tr>
              <tr className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium text-foreground">M</td>
                <td className="py-3 px-4 text-muted-foreground">44</td>
                <td className="py-3 px-4 text-muted-foreground">28.5</td>
                <td className="py-3 pl-4 text-muted-foreground">20</td>
              </tr>
              <tr className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium text-foreground">L</td>
                <td className="py-3 px-4 text-muted-foreground">46</td>
                <td className="py-3 px-4 text-muted-foreground">29.5</td>
                <td className="py-3 pl-4 text-muted-foreground">21</td>
              </tr>
              <tr className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium text-foreground">XL</td>
                <td className="py-3 px-4 text-muted-foreground">48</td>
                <td className="py-3 px-4 text-muted-foreground">30.5</td>
                <td className="py-3 pl-4 text-muted-foreground">22</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium text-foreground">XXL</td>
                <td className="py-3 px-4 text-muted-foreground">50</td>
                <td className="py-3 px-4 text-muted-foreground">31.5</td>
                <td className="py-3 pl-4 text-muted-foreground">23</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Fit Note */}
        <div className="bg-muted/30 border border-border p-4">
          <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-foreground mb-1">
            Fit Recommendations
          </h4>
          <p className="font-body text-xs text-muted-foreground leading-relaxed">
            Our tees feature a modern, dropped-shoulder relaxed fit. If you prefer a regular fit, we recommend ordering one size down.
          </p>
        </div>
      </div>
    </div>
  );
}
