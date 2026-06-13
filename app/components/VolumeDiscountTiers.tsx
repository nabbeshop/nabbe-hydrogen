export function VolumeDiscountTiers({ quantity }: { quantity: number }) {
  const tiers = [
    { qty: 2, discount: '10%', description: 'Buy 2 Pieces' },
    { qty: 3, discount: '15%', description: 'Buy 3 Pieces' },
    { qty: 4, discount: '20%', description: 'Buy 4+ Pieces' },
  ];

  const activeIndex = quantity >= 4 ? 2 : quantity === 3 ? 1 : quantity === 2 ? 0 : -1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-body text-xs uppercase tracking-[0.15em] text-foreground">
          Volume Discounts
        </span>
        {activeIndex !== -1 && (
          <span className="font-mono text-xs text-primary animate-pulse">
            ✓ {tiers[activeIndex].discount} Discount Applied
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {tiers.map((tier, idx) => {
          const isActive = activeIndex === idx;
          return (
            <div
              key={tier.qty}
              className={`border p-3 flex flex-col justify-between transition-all duration-300 relative overflow-hidden bg-card ${
                isActive
                  ? 'border-primary ring-1 ring-primary scale-[1.02]'
                  : 'border-border opacity-70 hover:opacity-100'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground font-mono text-[9px] translate-x-3 -translate-y-3 rotate-45 select-none">
                  ✓
                </div>
              )}
              <span className="font-mono text-lg font-bold text-foreground leading-none">
                {tier.discount} OFF
              </span>
              <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mt-2 block">
                {tier.description}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-body text-[10px] text-muted-foreground text-center italic mt-1.5">
        *Discounts will automatically calculate at checkout.
      </p>
    </div>
  );
}
