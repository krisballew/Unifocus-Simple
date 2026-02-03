import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound(): React.ReactElement {
  return (
    <div className="placeholder">
      <h2>Page not found</h2>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Return to Home</Link>
    </div>
  );
}
