import {
  Await,
  useLoaderData,
  Link,
} from 'react-router';
import type {Route} from './+types/_index';
import {Suspense, useState} from 'react';
import type {
  AllProductsQuery,
  HomepageCollectionsQuery,
} from 'storefrontapi.generated';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  const [collections] = await Promise.all([
    context.storefront.query(HOMEPAGE_COLLECTIONS_QUERY),
  ]);

  // Log the fetched collection images for debugging
  console.log('--- HOMEPAGE HERO LOADER DEBUG ---');
  console.log('Reel India Collection title:', collections.reelIndia?.title);
  console.log('Reel India Collection image:', collections.reelIndia?.image?.url);
  console.log('Reel India First Product image:', collections.reelIndia?.products?.nodes?.[0]?.featuredImage?.url);
  console.log('Machine Age Collection image:', collections.machineAge?.image?.url);
  console.log('Machine Age First Product image:', collections.machineAge?.products?.nodes?.[0]?.featuredImage?.url);
  console.log('Frequency Collection image:', collections.frequency?.image?.url);
  console.log('Frequency First Product image:', collections.frequency?.products?.nodes?.[0]?.featuredImage?.url);
  console.log('Charminar Tee product image:', collections.fallbackProduct?.featuredImage?.url);
  console.log('----------------------------------');

  return {
    collectionsData: collections,
  };
}

function loadDeferredData({context}: Route.LoaderArgs) {
  const allProducts = context.storefront
    .query(ALL_PRODUCTS_QUERY)
    .then((data) => {
      console.log('--- ALL PRODUCTS LOADER RESPONSE ---');
      console.log('Returned products count:', data?.products?.nodes?.length);
      if (data?.products?.nodes?.length > 0) {
        console.log('First product title:', data.products.nodes[0].title);
      } else {
        console.log('No products returned in data:', JSON.stringify(data));
      }
      console.log('------------------------------------');
      return data;
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error('All products query failed:', error);
      return null;
    });

  return {
    allProducts,
  };
}

export default function Homepage() {
  const {collectionsData, allProducts} = useLoaderData<typeof loader>();
  return (
    <div className="home bg-background text-foreground">
      <Hero collectionsData={collectionsData} />
      <CollectionsFilterSection />
      <AllProductsSection productsPromise={allProducts} />
    </div>
  );
}

// Fallback selector function for slide background image URL
function getSlideImage(
  collection: any,
  fallbackProductImage: string | undefined,
): string {
  if (collection?.image?.url) return collection.image.url;
  if (collection?.products?.nodes?.[0]?.featuredImage?.url) {
    return collection.products.nodes[0].featuredImage.url;
  }
  return fallbackProductImage || 'https://cdn.shopify.com/s/files/1/0688/1753/5224/files/photo-1542291026-7eec264c27ff.jpg?v=1680000000';
}

function Hero({
  collectionsData,
}: {
  collectionsData: HomepageCollectionsQuery;
}) {
  const {reelIndia, machineAge, frequency, fallbackProduct} = collectionsData;
  const [activeSlide, setActiveSlide] = useState(0);

  const fallbackUrl = fallbackProduct?.featuredImage?.url;

  const slides = [
    {
      image: getSlideImage(reelIndia, fallbackUrl),
      eyebrow: 'RETRO STREETWEAR, INDIA',
      headline: 'WEAR WHAT INDIA REMEMBERS.',
      body: 'Charminar packs. Reynolds pens. HMT watches. The objects that built a generation — on cotton.',
      buttonText: 'EXPLORE THE DROP →',
      buttonLink: '/collections/reel-india',
    },
    {
      image: getSlideImage(machineAge, fallbackUrl),
      eyebrow: 'RETRO INDUSTRIAL DESIGN',
      headline: 'MACHINE AGE INDIA.',
      body: 'Celebrating the heavy metal era, industrial design, and local locomotives of post-independence India.',
      buttonText: 'DISCOVER MACHINE AGE →',
      buttonLink: '/collections/machine-age-india',
    },
    {
      image: getSlideImage(frequency, fallbackUrl),
      eyebrow: 'RETRO AUDIO GRAPHICS',
      headline: 'SOUND & STATIC.',
      body: 'Vinyl records, cassette tapes, and late night radio frequencies. Tuning into local retro wave.',
      buttonText: 'TUNE IN NOW →',
      buttonLink: '/collections/frequency',
    },
  ];

  const nextSlide = () => setActiveSlide((activeSlide + 1) % slides.length);
  const prevSlide = () => setActiveSlide((activeSlide - 1 + slides.length) % slides.length);

  return (
    <div className="relative h-screen w-full flex flex-col justify-center items-start text-left px-6 md:px-16 lg:px-24 pt-[64px] bg-black overflow-hidden select-none">
      {/* Background Image Slider via CSS inline style with cover/center */}
      <div
        key={activeSlide}
        className="absolute inset-0 opacity-90 z-0 animate-fade-in"
        style={{
          backgroundImage: `url(${slides[activeSlide].image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Dark side gradient overlay: dark only on the left 40% where the text is, fading to near-transparent on the right */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.9) 40%, rgba(0, 0, 0, 0.15) 80%, rgba(0, 0, 0, 0) 100%)',
        }}
      />

      {/* Left-aligned content block */}
      <div className="relative z-10 w-full md:w-1/2 flex flex-col items-start gap-4 md:gap-6">
        {/* Eyebrow tag */}
        <div className="border-l-4 border-[#E8470A] pl-3.5">
          <span className="font-mono text-xs md:text-sm text-[#E8470A] uppercase tracking-[0.2em] font-semibold block">
            {slides[activeSlide].eyebrow}
          </span>
        </div>

        {/* Extra bold headline */}
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold uppercase leading-none tracking-tighter text-white">
          {slides[activeSlide].headline}
        </h1>

        {/* Body copy */}
        <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-[45ch]">
          {slides[activeSlide].body}
        </p>

        {/* Solid orange button */}
        <div className="pt-4">
          <Link
            to={slides[activeSlide].buttonLink}
            className="inline-block bg-[#E8470A] text-black font-body font-bold text-xs md:text-sm uppercase tracking-[0.18em] px-8 py-4.5 hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all duration-300"
          >
            {slides[activeSlide].buttonText}
          </Link>
        </div>
      </div>

      {/* Slide Navigation Arrows on Edges */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Previous Slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 text-white/40 hover:text-[#E8470A] hover:scale-110 active:scale-95 transition-all text-2xl md:text-3xl p-2 font-mono"
      >
        ←
      </button>
      <button
        type="button"
        onClick={nextSlide}
        aria-label="Next Slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white/40 hover:text-[#E8470A] hover:scale-110 active:scale-95 transition-all text-2xl md:text-3xl p-2 font-mono"
      >
        →
      </button>

      {/* Pagination Dot indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3.5 z-10">
        {slides.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveSlide(idx)}
            className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
              idx === activeSlide ? 'bg-[#E8470A] scale-125' : 'bg-muted-foreground/35 hover:bg-muted-foreground/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionsFilterSection() {
  const collectionsTabs = [
    {name: 'ALL TEES', path: '/collections/all'},
    {name: 'MACHINE AGE INDIA', path: '/collections/machine-age-india'},
    {name: 'REEL INDIA', path: '/collections/reel-india'},
    {name: 'FREQUENCY', path: '/collections/frequency'},
    {name: 'MAIDAN', path: '/collections/maidan'},
    {name: 'BAZAAR', path: '/collections/bazaar'},
    {name: 'FIELD NOTES', path: '/collections/field-notes'},
    {name: 'ONE LINERS', path: '/collections/one-liners'},
  ];

  return (
    <div className="container mx-auto px-6 pt-16 md:pt-24 pb-8">
      <div className="space-y-2">
        <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.25em] text-[#E8470A] font-bold block">
          SHOP BY COLLECTION
        </span>
        <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold uppercase tracking-tight text-foreground leading-none">
          ALL TEES
        </h2>
      </div>

      {/* Row of filter tabs styled as minimal underline links */}
      <div className="flex gap-8 overflow-x-auto pb-2 pt-8 scrollbar-none border-b border-border/40">
        {collectionsTabs.map((tab) => {
          const isActive = tab.name === 'ALL TEES';
          return (
            <Link
              key={tab.name}
              to={tab.path}
              className={`flex-shrink-0 font-mono text-[10px] md:text-xs uppercase tracking-widest pb-3 transition-all duration-300 ${
                isActive
                  ? 'text-primary border-b-2 border-primary font-bold'
                  : 'text-foreground/60 border-b-2 border-transparent hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AllProductsSection({
  productsPromise,
}: {
  productsPromise: Promise<AllProductsQuery | null>;
}) {
  return (
    <div className="container mx-auto px-6 pb-16 md:pb-24">
      <Suspense
        fallback={
          <div className="font-mono text-xs text-muted-foreground text-center">
            Loading products...
          </div>
        }
      >
        <Await resolve={productsPromise}>
          {(response) => {
            const products = response?.products?.nodes || [];
            if (products.length === 0) {
              return (
                <div className="text-center font-mono text-xs text-muted-foreground py-16">
                  No products found.
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
                {products.map((product) => {
                  const price = product.priceRange.minVariantPrice;
                  const compareAtPrice = product.compareAtPriceRange?.minVariantPrice;
                  const isOnSale =
                    compareAtPrice &&
                    parseFloat(compareAtPrice.amount) > parseFloat(price.amount);
                  return (
                    <Link
                      key={product.id}
                      to={`/products/${product.handle}`}
                      className="group flex flex-col bg-transparent border-0 rounded-none shadow-none text-foreground select-none"
                    >
                      <div className="relative overflow-hidden aspect-[3/4] bg-transparent">
                        {product.featuredImage ? (
                          <img
                            src={product.featuredImage.url}
                            alt={product.featuredImage.altText || product.title}
                            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-[10px]">
                            No image available
                          </div>
                        )}
                        {/* Hover Overlay with ADD TO BAG Text */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                          <span className="text-white text-xs uppercase tracking-[0.25em] font-bold">
                            ADD TO BAG
                          </span>
                        </div>
                      </div>
                      <div className="pt-4 flex flex-col gap-1">
                        <h3 className="font-bold uppercase tracking-tight text-lg text-foreground transition-colors group-hover:text-primary">
                          {product.title}
                        </h3>
                        <div className="font-mono text-sm text-muted-foreground flex items-center gap-3">
                          {isOnSale && compareAtPrice && (
                            <span className="line-through">
                              {compareAtPrice.currencyCode} {parseFloat(compareAtPrice.amount).toFixed(2)}
                            </span>
                          )}
                          <span>
                            {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}

const HOMEPAGE_COLLECTIONS_FRAGMENT = `#graphql
  fragment HomepageCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
    products(first: 1) {
      nodes {
        featuredImage {
          url
          altText
          width
          height
        }
      }
    }
  }
` as const;

const HOMEPAGE_COLLECTIONS_QUERY = `#graphql
  query HomepageCollections($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    reelIndia: collection(handle: "reel-india") {
      ...HomepageCollection
    }
    machineAge: collection(handle: "machine-age-india") {
      ...HomepageCollection
    }
    frequency: collection(handle: "frequency") {
      ...HomepageCollection
    }
    fallbackProduct: product(handle: "charminar-tee") {
      featuredImage {
        url
        altText
        width
        height
      }
    }
  }
  ${HOMEPAGE_COLLECTIONS_FRAGMENT}
` as const;

const ALL_PRODUCTS_QUERY = `#graphql
  query AllProducts {
    products(first: 50, sortKey: BEST_SELLING) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        compareAtPriceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;

// Kept only for type compatibility in product list items across the project
const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
` as const;

