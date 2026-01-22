import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'game';
  noIndex?: boolean;
  jsonLd?: object;
}

const SITE_NAME = 'Ndogmoabeng';
const DEFAULT_DESCRIPTION = 'Le village de Ndogmoabeng - Jeux de société interactifs en ligne. Stratégie, mystère et bluff dans un univers africain unique avec 7 clans.';
const DEFAULT_KEYWORDS = 'jeux de société, jeux en ligne, stratégie, bluff, Ndogmoabeng, jeux africains, jeux interactifs, forêt, rivières, infection';
const DEFAULT_IMAGE = 'https://ndogmoabeng.lovable.app/favicon.png';
const SITE_URL = 'https://ndogmoabeng.lovable.app';

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noIndex = false,
  jsonLd,
}: SEOHeadProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const canonicalUrl = url ? `${SITE_URL}${url}` : SITE_URL;

  // Default organization schema
  const defaultJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/watch?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Ndogmoabeng" />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content="fr_FR" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Additional SEO Tags */}
      <meta name="theme-color" content="#1a1a2e" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="format-detection" content="telephone=no" />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLd || defaultJsonLd)}
      </script>
    </Helmet>
  );
}

// Pre-configured SEO components for common pages
export function HomeSEO() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ndogmoabeng',
    description: 'Le village de Ndogmoabeng - Jeux de société interactifs en ligne',
    url: 'https://ndogmoabeng.lovable.app',
    publisher: {
      '@type': 'Organization',
      name: 'Ndogmoabeng',
      logo: {
        '@type': 'ImageObject',
        url: 'https://ndogmoabeng.lovable.app/favicon.png',
      },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://ndogmoabeng.lovable.app/watch?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <SEOHead
      description="Découvrez Ndogmoabeng, un univers de jeux de société interactifs en ligne. Sept clans, des choix stratégiques, du bluff et une mémoire à défendre. Jouez à La Forêt, Les Rivières ou Infection."
      keywords="jeux de société en ligne, jeux stratégie, jeux bluff, Ndogmoabeng, jeux africains, jeux interactifs multijoueurs, forêt ndogmoabeng, rivières, infection"
      url="/"
      jsonLd={jsonLd}
    />
  );
}

export function GamesSEO({ gameName, gameDescription }: { gameName: string; gameDescription: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Game',
    name: gameName,
    description: gameDescription,
    genre: ['Strategy', 'Social Deduction', 'Party Game'],
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: 4,
      maxValue: 20,
    },
    gameLocation: {
      '@type': 'VirtualLocation',
      url: 'https://ndogmoabeng.lovable.app',
    },
  };

  return (
    <SEOHead
      title={gameName}
      description={gameDescription}
      type="game"
      jsonLd={jsonLd}
    />
  );
}

export function WatchSEO() {
  return (
    <SEOHead
      title="Regarder les parties"
      description="Observez les parties en cours de Ndogmoabeng en temps réel. Suivez les stratégies des joueurs dans La Forêt, Les Rivières et Infection."
      keywords="spectateur jeux, regarder parties, live gaming, Ndogmoabeng spectacle"
      url="/watch"
    />
  );
}

export function ProfileSEO() {
  return (
    <SEOHead
      title="Mon Profil"
      description="Gérez votre profil joueur Ndogmoabeng. Consultez vos statistiques, historique de parties et gérez vos paramètres."
      noIndex={true}
      url="/profile"
    />
  );
}

export function AuthSEO() {
  return (
    <SEOHead
      title="Connexion"
      description="Connectez-vous à Ndogmoabeng pour créer des parties, rejoindre vos amis et suivre vos statistiques de jeu."
      url="/auth"
    />
  );
}

export function MJDashboardSEO() {
  return (
    <SEOHead
      title="Tableau de bord MJ"
      description="Gérez vos parties Ndogmoabeng en tant que Maître du Jeu. Créez, configurez et animez des sessions de jeux."
      noIndex={true}
      url="/mj"
    />
  );
}
