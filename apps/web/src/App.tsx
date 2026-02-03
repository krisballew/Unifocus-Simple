import type { User } from '@unifocus/contracts';
import { translate } from '@unifocus/i18n';
import { Button } from '@unifocus/ui';
import { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/users');
      const data = (await response.json()) as { data: User[] };
      setUsers(data.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>{translate(lang, 'welcome')} to Unifocus Simple</h1>
      <p>Count: {count}</p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button onClick={() => setCount(count + 1)}>Increment</Button>
        <Button onClick={() => setCount(0)} variant="secondary">
          Reset
        </Button>
        <Button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} variant="secondary">
          Toggle Language ({lang})
        </Button>
        <Button onClick={fetchUsers} variant="secondary">
          Fetch Users
        </Button>
      </div>
      {users.length > 0 && (
        <div>
          <h2>Users</h2>
          <ul>
            {users.map((user) => (
              <li key={user.id}>
                {user.firstName} {user.lastName} - {user.email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
