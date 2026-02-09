'use client';

import * as React from 'react';

import ActionListItem from '@components/ActionListItem';
import Card from '@components/Card';

const EXAMPLES = [
  { label: 'AAPL vs Gold (1Y)', path: '/?equity=AAPL&benchmark=gold' },
  { label: 'TSMC, AAPL, MSFT vs Gold', path: '/?equity=TSMC,AAPL,MSFT&benchmark=gold' },
  { label: 'TSMC, AAPL, MSFT vs Gold, ETH, USD', path: '/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd' },
  { label: 'AAPL, MSFT vs Gold (5Y)', path: '/?equity=AAPL,MSFT&benchmark=gold&range=5y' },
  { label: 'MSFT vs ETH (YTD)', path: '/?equity=MSFT&benchmark=eth&range=ytd' },
];

export default function CopyURLExamples() {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const onCopy = async (index: number, path: string) => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback: select text in a temporary input
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <Card title="EXAMPLE URLS">
      {EXAMPLES.map((example, i) => (
        <ActionListItem key={i} icon={copiedIndex === i ? '✓' : '⊹'} onClick={() => onCopy(i, example.path)}>
          {example.label} — {example.path}
        </ActionListItem>
      ))}
    </Card>
  );
}
