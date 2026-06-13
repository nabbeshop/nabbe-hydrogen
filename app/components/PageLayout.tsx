import {Await, Link} from 'react-router';
import {Suspense, useId} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {
  SEARCH_ENDPOINT,
  SearchFormPredictive,
} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
}: PageLayoutProps) {
  return (
    <Aside.Provider>
      <CartAside cart={cart} />
      <SearchAside />
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <div 
        className="ticker-container relative z-30 select-none pointer-events-none w-full flex overflow-hidden border-b border-border"
        style={{
          backgroundColor: '#E8470A',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden'
        }}
      >
        <div className="ticker-track flex w-max animate-[marquee_30s_linear_infinite]">
          <span className="ticker-text font-mono text-[10px] tracking-[0.15em] text-black font-bold uppercase whitespace-nowrap inline-flex items-center" style={{ color: '#000000' }}>ALL TEES ✦ सारी टीशर्ट्स ✦ THE ARCHIVE ✦ MACHINE AGE INDIA ✦ REEL INDIA ✦ FREQUENCY ✦&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span className="ticker-text font-mono text-[10px] tracking-[0.15em] text-black font-bold uppercase whitespace-nowrap inline-flex items-center" style={{ color: '#000000' }}>ALL TEES ✦ सारी टीशर्ट्स ✦ THE ARCHIVE ✦ MACHINE AGE INDIA ✦ REEL INDIA ✦ FREQUENCY ✦&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span className="ticker-text font-mono text-[10px] tracking-[0.15em] text-black font-bold uppercase whitespace-nowrap inline-flex items-center" style={{ color: '#000000' }}>ALL TEES ✦ सारी टीशर्ट्स ✦ THE ARCHIVE ✦ MACHINE AGE INDIA ✦ REEL INDIA ✦ FREQUENCY ✦&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span className="ticker-text font-mono text-[10px] tracking-[0.15em] text-black font-bold uppercase whitespace-nowrap inline-flex items-center" style={{ color: '#000000' }}>ALL TEES ✦ सारी टीशर्ट्स ✦ THE ARCHIVE ✦ MACHINE AGE INDIA ✦ REEL INDIA ✦ FREQUENCY ✦&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      </div>
      <main>{children}</main>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside.Provider>
  );
}

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  return (
    <Aside type="cart" heading="CART">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

function SearchAside() {
  const queriesDatalistId = useId();
  return (
    <Aside type="search" heading="SEARCH">
      <div className="predictive-search">
        <br />
        <SearchFormPredictive>
          {({fetchResults, goToSearch, inputRef}) => (
            <>
              <input
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search"
                ref={inputRef}
                type="search"
                list={queriesDatalistId}
              />
              &nbsp;
              <button onClick={goToSearch}>Search</button>
            </>
          )}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products, queries} = items;

            if (state === 'loading' && term.current) {
              return <div>Loading...</div>;
            }

            if (!total) {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            return (
              <>
                <SearchResultsPredictive.Queries
                  queries={queries}
                  queriesDatalistId={queriesDatalistId}
                />
                <SearchResultsPredictive.Products
                  products={products}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Collections
                  collections={collections}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Pages
                  pages={pages}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Articles
                  articles={articles}
                  closeSearch={closeSearch}
                  term={term}
                />
                {term.current && total ? (
                  <Link
                    onClick={closeSearch}
                    to={`${SEARCH_ENDPOINT}?q=${term.current}`}
                  >
                    <p>
                      View all results for <q>{term.current}</q>
                      &nbsp; →
                    </p>
                  </Link>
                ) : null}
              </>
            );
          }}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  publicStoreDomain,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
}) {
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="MENU">
        <HeaderMenu
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
      </Aside>
    )
  );
}
