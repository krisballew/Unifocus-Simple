import type { ApiResponse, User } from '@unifocus/contracts';
import { translate } from '@unifocus/i18n';
import express, { type Request, type Response } from 'express';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/users', (_req: Request, res: Response<ApiResponse<User[]>>) => {
  const users: User[] = [{ id: '1', email: 'user@example.com', name: 'John Doe' }];
  res.json({ data: users });
});

app.get('/api/greeting', (req: Request, res: Response) => {
  const lang = (req.query['lang'] as 'en' | 'es') ?? 'en';
  const greeting = translate(lang, 'welcome');
  res.json({ greeting });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
