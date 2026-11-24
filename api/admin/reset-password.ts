import { verifyAdminRequest } from '../../server/supabaseAdmin.ts';

interface ApiRequest {
  method?: string;
  headers: { authorization?: string };
  body?: Record<string, unknown>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak didukung.' });
  }

  try {
    const { adminClient } = await verifyAdminRequest(req.headers.authorization);
    const { userId, newPassword } = req.body ?? {};

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'ID pengguna tidak valid.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan server.';
    if (message.startsWith('SERVICE_ROLE_MISSING:')) {
      return res.status(503).json({
        error: message.replace('SERVICE_ROLE_MISSING: ', ''),
        code: 'SERVICE_ROLE_MISSING',
      });
    }
    if (message.startsWith('UNAUTHORIZED:')) {
      return res.status(401).json({ error: message.replace('UNAUTHORIZED: ', '') });
    }
    if (message.startsWith('FORBIDDEN:')) {
      return res.status(403).json({ error: message.replace('FORBIDDEN: ', '') });
    }
    return res.status(500).json({ error: message });
  }
}
