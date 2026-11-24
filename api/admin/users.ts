import { verifyAdminRequest } from '../../server/supabaseAdmin.ts';

interface ApiRequest {
  method?: string;
  headers: { authorization?: string };
  body?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const { adminClient, callerId } = await verifyAdminRequest(req.headers.authorization);

    if (req.method === 'POST') {
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
      if (role !== 'admin' && role !== 'guru' && role !== 'siswa') {
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
        return res.status(400).json({ error: createError?.message || 'Gagal membuat akun.' });
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
          subject_id: typeof subject_id === 'string' && subject_id ? subject_id : null,
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
          class_id: typeof class_id === 'string' && class_id ? class_id : null,
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
    }

    if (req.method === 'DELETE') {
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
    }

    return res.status(405).json({ error: 'Metode tidak didukung.' });
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
