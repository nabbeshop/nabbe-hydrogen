import {NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer: _footerPromise,
  header: _header,
  publicStoreDomain: _publicStoreDomain,
}: FooterProps) {
  return (
    <footer className="footer bg-background border-t border-border py-12 px-6 md:px-12 text-foreground font-body">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8 md:gap-16">
        {/* Brand Info */}
        <div className="space-y-4">
          <NavLink
            to="/"
            className="font-display text-2xl uppercase tracking-[0.2em] text-primary font-bold transition-all hover:opacity-90"
          >
            Nabbe
          </NavLink>
          <p className="text-xs text-muted-foreground max-w-[30ch] leading-relaxed">
            Premium limited-run apparel, thoughtfully designed and crafted in India.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-[0.15em] text-foreground font-semibold">
              Explore
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <NavLink
                  to="/shop"
                  className="text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                >
                  Shop
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/pages/about"
                  className="text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                >
                  About
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/pages/contact"
                  className="text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                >
                  Contact
                </NavLink>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-[0.15em] text-foreground font-semibold">
              Social
            </h4>
            <div className="flex items-center gap-4">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" stroke="currentColor" />
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01" stroke="currentColor" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto border-t border-border/30 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-none">
          © 2024 Nabbe Shop Private Limited. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
