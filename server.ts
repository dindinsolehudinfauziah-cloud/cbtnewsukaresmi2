import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { verifyAdminRequest } from './server/supabaseAdmin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  });
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { adminClient } = await verifyAdminRequest(req.headers.authorization);
    const {
      username,
      email,
      password,
      full_name,
      role,
      nip,
      subject_id,
      phone,
      nis,
      nisn,
      class_id,
      gender,
    } = req.body ?? {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter.' });
    }
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }
    if (!['admin', 'guru', 'siswa'].includes(role)) {
      return res.status(400).json({ error: 'Peran pengguna tidak valid.' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    const cleanEmail =
      typeof email === 'string' && email.trim().includes('@')
        ? email.trim().toLowerCase()
        : `${cleanUsername}@smpn2sukaresmi.sch.id`;

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        full_name: full_name.trim(),
        role,
      },
    });

    if (createError || !created.user) {
      return res.status(400).json({
        error: createError?.message || 'Gagal membuat akun autentikasi Supabase.',
      });
    }

    const userId = created.user.id;

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      full_name: full_name.trim(),
      role,
      is_active: true,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: profileError.message });
    }

    if (role === 'guru') {
      const { error: teacherError } = await adminClient.from('teachers').insert({
        profile_id: userId,
        nip: nip ? String(nip).trim() : null,
        subject_id: subject_id || null,
        phone: phone ? String(phone).trim() : null,
      });

      if (teacherError) {
        await adminClient.auth.admin.deleteUser(userId);
        return res.status(400).json({ error: teacherError.message });
      }
    } else if (role === 'siswa') {
      const { error: studentError } = await adminClient.from('students').insert({
        profile_id: userId,
        nis: nis ? String(nis).trim() : null,
        nisn: nisn ? String(nisn).trim() : null,
        class_id: class_id || null,
        gender: gender === 'L' || gender === 'P' ? gender : null,
      });

      if (studentError) {
        await adminClient.auth.admin.deleteUser(userId);
        return res.status(400).json({ error: studentError.message });
      }
    }

    return res.status(201).json({
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      full_name: full_name.trim(),
      role,
    });
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
});

app.delete('/api/admin/users', async (req, res) => {
  try {
    const { adminClient, callerId } = await verifyAdminRequest(req.headers.authorization);
    const targetId =
      typeof req.query?.id === 'string'
        ? req.query.id
        : typeof req.body?.id === 'string'
          ? req.body.id
          : '';

    if (!targetId || targetId === callerId) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri.' });
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ deleted: true });
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
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { adminClient, callerId } = await verifyAdminRequest(req.headers.authorization);
    const targetId = req.params.id;

    if (!targetId || targetId === callerId) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri.' });
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ deleted: true });
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
});

app.post('/api/admin/reset-password', async (req, res) => {
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
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server CBT SMPN 2 Sukaresmi berjalan di http://localhost:${PORT}`);
  });
}

startServer();
