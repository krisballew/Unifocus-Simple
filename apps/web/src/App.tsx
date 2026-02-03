import { translate } from '@unifocus/i18n';
import { Button } from '@unifocus/ui';
import { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);
  const [lang, setLang] = useState<'en' | 'es'>('en');

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>{translate(lang, 'welcome')} to Unifocus Simple</h1>
      <p>Count: {count}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button onClick={() => setCount(count + 1)}>Increment</Button>
        <Button onClick={() => setCount(0)} variant="secondary">
          Reset
        </Button>
        <Button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} variant="secondary">
          Toggle Language ({lang})
        </Button>
      </div>
    </div>
  );
}
