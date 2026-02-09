import '@root/global-fonts.css';
import '@root/global.css';

import { Suspense } from 'react';

import DefaultLayout from '@components/page/DefaultLayout';
import PortfolioCompare from '@components/PortfolioCompare';

export async function generateMetadata({ params, searchParams }) {
  const title = 'Portfolio Compare';
  const description = 'Compare equity performance against benchmarks like gold, ETH, and USD over time.';
  const url = 'https://lil-intdev-portfolio-compare.vercel.app';
  const handle = '@internetxstudio';

  return {
    description,
    icons: {
      apple: [{ url: '/apple-touch-icon.png' }, { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      icon: '/favicon-32x32.png',
      other: [
        {
          rel: 'apple-touch-icon-precomposed',
          url: '/apple-touch-icon-precomposed.png',
        },
      ],
      shortcut: '/favicon-16x16.png',
    },
    metadataBase: new URL(url),
    openGraph: {
      description,
      title,
      type: 'website',
      url,
    },
    title,
    twitter: {
      card: 'summary_large_image',
      description,
      handle,
      title,
      url,
    },
    url,
  };
}

export default async function Page(props) {
  return (
    <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
      <Suspense>
        <PortfolioCompare />
      </Suspense>
    </DefaultLayout>
  );
}
