import * as React from 'react';

import Card from '@components/Card';

const LandingState: React.FC = () => {
  return (
    <Card title="PORTFOLIO COMPARE">
      <p>
        Compare equity portfolio performance against benchmarks. Add equities to the URL to get started:
      </p>
      <p style={{ marginTop: 8 }}>
        <code>?equity=AAPL,MSFT,GOOG&benchmark=gold&range=1y</code>
      </p>
      <p style={{ marginTop: 8, opacity: 0.5, fontSize: '0.85em' }}>
        Add <code>&amount=10000</code> to simulate a dollar investment.
      </p>
    </Card>
  );
};

export default LandingState;
