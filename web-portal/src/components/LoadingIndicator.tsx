import React from 'react';

interface LoadingIndicatorProps {
  isLoading: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ isLoading }) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="loading-bar-container">
      <div className="loading-bar"></div>
    </div>
  );
};

export default LoadingIndicator;
