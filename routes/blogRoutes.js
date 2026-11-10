const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const sessionCookieName = 'commonplace_session';
const sessionLifetime = 30 * 24 * 60 * 60 * 1000;

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Configure Multer storage
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/avif': '.avif'
    };
    cb(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Cover image must be JPEG, PNG, GIF, WebP, or AVIF');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  }
});

const parseBlogId = (id) => {
  const blogId = Number(id);
  return Number.isInteger(blogId) && blogId > 0 ? blogId : null;
};

const removeUploadedFile = (file) => {
  if (file) {
    fs.unlink(path.join(uploadDir, file), (error) => {
      if (error && error.code !== 'ENOENT') {
        console.error(`Failed to remove uploaded image "${file}":`, error);
      }
    });
  }
};

const findBlog = (id) => db.prepare('SELECT * FROM blogs WHERE id = ?').get(id);
const findUser = (id) => db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);

const getSessionToken = (req) => {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const sessionCookie = cookie.split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${sessionCookieName}=`));
  return sessionCookie ? sessionCookie.slice(sessionCookieName.length + 1) : null;
};

const attachUser = (req, res, next) => {
  const token = getSessionToken(req);
  if (!token || token.length > 200) {
    req.user = null;
    return next();
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = db.prepare(`
    SELECT users.id, users.username, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash);

  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    req.user = null;
    return next();
  }

  req.user = { id: session.id, username: session.username };
  return next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue' });
  return next();
};

const trustedOrigins = new Set(
  (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get('origin');
  if (origin && !trustedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed' });
  }
  return next();
};

const setSessionCookie = (res, token) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(sessionLifetime / 1000)}${secure}`
  );
};

const clearSessionCookie = (res) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
};

const savePassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
};

const verifyPassword = async (password, storedPassword) => {
  const [saltHex, hashHex] = storedPassword.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const createSession = (userId, res) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + sessionLifetime;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  setSessionCookie(res, token);
};

router.use(attachUser);

router.post('/auth/signup', requireTrustedOrigin, async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–30 characters using letters, numbers, dots, dashes, or underscores' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
  }

  try {
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, await savePassword(password));
    const user = findUser(result.lastInsertRowid);
    createSession(user.id, res);
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    throw error;
  }
});

router.post('/auth/login', requireTrustedOrigin, async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Enter your username and password' });
  }

  const account = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE')
    .get(username);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return res.status(401).json({ error: 'Username or password is incorrect' });
  }

  createSession(account.id, res);
  return res.json({ user: { id: account.id, username: account.username } });
});

router.post('/auth/logout', requireTrustedOrigin, (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }
  clearSessionCookie(res);
  return res.json({ message: 'Signed out' });
});

router.get('/auth/me', (req, res) => res.json({ user: req.user }));

const requestGemini = async (systemPrompt, userPrompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('Gemini is not configured. Set GEMINI_API_KEY on the server.');
    error.status = 503;
    throw error;
  }

  const model = encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 }
      }),
      signal: AbortSignal.timeout(30000)
    }
  );

  if (!response.ok) {
    const error = new Error(`Gemini API returned HTTP ${response.status}`);
    error.status = 502;
    throw error;
  }

  const result = await response.json();
  const parts = result.candidates && result.candidates[0]
    && result.candidates[0].content && result.candidates[0].content.parts;
  const content = Array.isArray(parts)
    ? parts.map((part) => part.text || '').join('')
    : '';
  if (typeof content !== 'string' || !content.trim()) {
    const error = new Error('Gemini returned an empty response');
    error.status = 502;
    throw error;
  }
  return content.trim();
};

// GET all blogs
router.get('/blogs', (req, res) => {
  const stmt = db.prepare(`
    SELECT blogs.id, blogs.title, blogs.content, blogs.image,
      CASE WHEN ? = 1 THEN blogs.likes ELSE NULL END AS likes,
      CASE WHEN ? = 1 THEN blogs.dislikes ELSE NULL END AS dislikes,
      blogs.created_at, users.username AS author
    FROM blogs LEFT JOIN users ON users.id = blogs.author_id
    ORDER BY blogs.created_at DESC
  `);
  return res.json(stmt.all(req.user ? 1 : 0, req.user ? 1 : 0));
});

// GET blogs and engagement stats for the signed-in author's dashboard
router.get('/my/blogs', requireAuth, (req, res) => {
  const blogs = db.prepare(`
    SELECT id, title, content, image, likes, dislikes, created_at
    FROM blogs WHERE author_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  return res.json(blogs);
});

// GET one blog
router.get('/blogs/:id', (req, res) => {
  const id = parseBlogId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid blog ID' });

  const blog = findBlog(id);
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  if (!req.user) {
    const { likes, dislikes, ...publicBlog } = blog;
    return res.json(publicBlog);
  }
  return res.json(blog);
});

// POST a new blog with an image
router.post('/blogs', requireAuth, requireTrustedOrigin, upload.single('image'), (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const image = req.file ? req.file.filename : null;

  if (!title || !content) {
    removeUploadedFile(image);
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const stmt = db.prepare('INSERT INTO blogs (title, content, image, author_id) VALUES (?, ?, ?, ?)');
  const info = stmt.run(title, content, image, req.user.id);
  return res.status(201).json({
    id: info.lastInsertRowid,
    title,
    content,
    image,
    author: req.user.username,
    likes: 0,
    dislikes: 0
  });
});

// UPDATE an existing blog
router.put('/blogs/:id', requireAuth, requireTrustedOrigin, upload.single('image'), (req, res) => {
  const id = parseBlogId(req.params.id);
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

  if (!id) {
    removeUploadedFile(req.file && req.file.filename);
    return res.status(400).json({ error: 'Invalid blog ID' });
  }
  if (!title || !content) {
    removeUploadedFile(req.file && req.file.filename);
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const blog = findBlog(id);
  if (!blog) {
    removeUploadedFile(req.file && req.file.filename);
    return res.status(404).json({ error: 'Blog not found' });
  }
  if (blog.author_id !== req.user.id) {
    removeUploadedFile(req.file && req.file.filename);
    return res.status(403).json({ error: 'You can only edit your own stories' });
  }

  const image = req.file ? req.file.filename : blog.image;
  db.prepare('UPDATE blogs SET title = ?, content = ?, image = ? WHERE id = ?')
    .run(title, content, image, id);
  if (req.file && blog.image) removeUploadedFile(blog.image);
  return res.json({ ...blog, title, content, image });
});

// DELETE a blog
router.delete('/blogs/:id', requireAuth, requireTrustedOrigin, (req, res) => {
  const id = parseBlogId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid blog ID' });

  const blog = findBlog(id);
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  if (blog.author_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own stories' });
  }

  db.prepare('DELETE FROM blogs WHERE id = ?').run(id);
  if (blog.image) removeUploadedFile(blog.image);
  return res.json({ message: 'Blog deleted successfully' });
});

// ADD a like or dislike
router.put('/blogs/:id/:type', requireAuth, requireTrustedOrigin, (req, res) => {
  const id = parseBlogId(req.params.id);
  const column = req.params.type === 'like'
    ? 'likes'
    : req.params.type === 'dislike'
      ? 'dislikes'
      : null;

  if (!id) return res.status(400).json({ error: 'Invalid blog ID' });
  if (!column) return res.status(404).json({ error: 'Invalid interaction type' });

  const result = db.prepare(`UPDATE blogs SET ${column} = ${column} + 1 WHERE id = ?`).run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Blog not found' });
  return res.json(findBlog(id));
});

// GET comments for one blog
router.get('/blogs/:id/comments', (req, res) => {
  const id = parseBlogId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid blog ID' });
  if (!findBlog(id)) return res.status(404).json({ error: 'Blog not found' });

  const comments = db.prepare(
    'SELECT id, blog_id, comment AS text FROM comments WHERE blog_id = ? ORDER BY id'
  ).all(id);
  return res.json(comments);
});

// ADD a comment
router.post('/blogs/:id/comments', requireAuth, requireTrustedOrigin, (req, res) => {
  const id = parseBlogId(req.params.id);
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!id) return res.status(400).json({ error: 'Invalid blog ID' });
  if (!text || text.length > 5000) {
    return res.status(400).json({ error: 'Comment must be between 1 and 5000 characters' });
  }
  if (!findBlog(id)) return res.status(404).json({ error: 'Blog not found' });

  const result = db.prepare('INSERT INTO comments (blog_id, comment) VALUES (?, ?)').run(id, text);
  return res.status(201).json({ id: result.lastInsertRowid, blog_id: id, text });
});

// POLISH blog content through the Gemini API
router.post('/ai/polish', requireAuth, requireTrustedOrigin, async (req, res) => {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 30000) {
    return res.status(400).json({ error: 'Content must be between 1 and 30000 characters' });
  }

  try {
    const polishedContent = await requestGemini(
      'Improve grammar, clarity, and flow while preserving meaning. Return only the revised article HTML. Preserve its HTML structure, formatting, links, images, and image source placeholders exactly.',
      content
    );
    return res.json({ polishedContent });
  } catch (error) {
    console.error('Gemini polish request failed:', error);
    return res.status(error.status || 502).json({
      error: error.status === 503
        ? error.message
        : 'AI text polishing is temporarily unavailable'
    });
  }
});

// GENERATE comma-separated tags through the Gemini API
router.post('/ai/tags', requireAuth, requireTrustedOrigin, async (req, res) => {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 30000) {
    return res.status(400).json({ error: 'Content must be between 1 and 30000 characters' });
  }

  try {
    const tags = await requestGemini(
      'Suggest 5 to 8 short, relevant topic tags for the article. Return only comma-separated tags, with no numbering or explanation.',
      content
    );
    return res.json({ tags });
  } catch (error) {
    console.error('Gemini tag request failed:', error);
    return res.status(error.status || 502).json({
      error: error.status === 503
        ? error.message
        : 'AI tag generation is temporarily unavailable'
    });
  }
});

module.exports = router;