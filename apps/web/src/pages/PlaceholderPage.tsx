import React from 'react';

export interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps): React.ReactElement {
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p>{description ?? 'This section is coming soon.'}</p>
    </div>
  );
}
