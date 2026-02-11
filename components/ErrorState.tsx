import * as React from 'react';

import AlertBanner from '@components/AlertBanner';
import Card from '@components/Card';

interface ErrorStateProps {
  title: string;
  message: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ title, message }) => {
  return (
    <Card title="ERROR">
      <AlertBanner>
        <strong>{title}:</strong> {message}
      </AlertBanner>
    </Card>
  );
};

export default ErrorState;
