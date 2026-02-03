import type { ApiResponse, User } from '@unifocus/contracts';
import { UserSchema } from '@unifocus/contracts';
import { translate } from '@unifocus/i18n';
import express, { type Request, type Response } from 'express';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/users', (_req: Request, res: Response<ApiResponse<User[]>>) => {
  const users: User[] = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      tenantId: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      roleId: 'b2c3d4e5-6789-01bc-def0-234567890abc',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Validate with Zod schema
  try {
    users.forEach((user) => UserSchema.parse(user));
    res.json({ data: users });
  } catch (error) {
    res.status(400).json({ data: [], error: 'Invalid user data' });
  }
});

app.get('/api/greeting', (req: Request, res: Response) => {
  const lang = (req.query['lang'] as 'en' | 'es') ?? 'en';
  const greeting = translate(lang, 'welcome');
  res.json({ greeting });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
