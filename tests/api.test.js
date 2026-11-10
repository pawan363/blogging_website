const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const EventEmitter = require('events');

// Use isolated SQLite test database
const testDbPath = path.join(__dirname, 'test-blog.db');
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';

// Remove leftover test database if any
for (const ext of ['', '-wal', '-shm', '-journal']) {
  const f = testDbPath + ext;
  if (fs.existsSync(f)) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
}

const app = require('../server');
const db = require('../config/db');

// In-memory HTTP request dispatcher for Express
function makeRequest(method, url, { headers = {}, body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    let rawBody = null;
    const reqHeaders = {
      host: 'localhost:5000',
      ...headers
    };

    if (cookie) {
      reqHeaders['cookie'] = cookie;
    }

    if (body !== undefined) {
      if (typeof body === 'object') {
        rawBody = Buffer.from(JSON.stringify(body));
        reqHeaders['content-type'] = 'application/json';
        reqHeaders['content-length'] = String(rawBody.length);
      } else {
        rawBody = Buffer.from(String(body));
        reqHeaders['content-length'] = String(rawBody.length);
      }
    }

    const req = Readable.from(rawBody ? [rawBody] : []);
    req.method = method;
    req.url = url;
    req.headers = reqHeaders;
    req.get = (name) => req.headers[name.toLowerCase()];

    const resHeaders = {};
    const chunks = [];
    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = (name, val) => {
      resHeaders[name.toLowerCase()] = val;
    };
    res.getHeader = (name) => resHeaders[name.toLowerCase()];
    res.getHeaders = () => resHeaders;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
    res.send = (data) => {
      res.end(data);
      return res;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const bodyStr = Buffer.concat(chunks).toString();
      let parsed = null;
      try {
        parsed = JSON.parse(bodyStr);
      } catch (_) {
        parsed = bodyStr;
      }

      const setCookie = resHeaders['set-cookie'];
      resolve({
        status: res.statusCode,
        headers: resHeaders,
        data: parsed,
        cookie: setCookie ? setCookie.split(';')[0] : null
      });
    };

    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

after(() => {
  try {
    db.close();
    for (const ext of ['', '-wal', '-shm', '-journal']) {
      const f = testDbPath + ext;
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  } catch (_) {}
});

describe('Full Stack Blogging Platform Test Suite', () => {
  let user1Cookie = null;
  let user1Id = null;
  let user2Cookie = null;
  let user2Id = null;
  let createdBlogId = null;

  describe('1. Security & CORS Validation', () => {
    test('rejects requests from disallowed origins on protected routes with 403', async () => {
      const res = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://malicious-website.com' },
        body: { username: 'attacker', password: 'password123' }
      });
      assert.equal(res.status, 403);
      assert.equal(res.data.error, 'Request origin is not allowed');
    });

    test('allows requests from trusted frontend origin (http://localhost:5173)', async () => {
      const res = await makeRequest('GET', '/api/auth/me', {
        headers: { origin: 'http://localhost:5173' }
      });
      assert.equal(res.status, 200);
      assert.deepEqual(res.data, { user: null });
    });
  });

  describe('2. Authentication & Sessions', () => {
    test('signup fails with short or invalid username', async () => {
      const res = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'ab', password: 'password123' }
      });
      assert.equal(res.status, 400);
      assert.match(res.data.error, /Username must be/);
    });

    test('signup fails with password less than 8 chars', async () => {
      const res = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'alice_writer', password: '123' }
      });
      assert.equal(res.status, 400);
      assert.match(res.data.error, /Password must be/);
    });

    test('signup succeeds with valid credentials and sets session cookie', async () => {
      const res = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'alice_writer', password: 'SecurePassword123!' }
      });
      assert.equal(res.status, 201);
      assert.ok(res.data.user);
      assert.equal(res.data.user.username, 'alice_writer');
      assert.ok(res.cookie);
      assert.match(res.cookie, /commonplace_session=/);
      user1Cookie = res.cookie;
      user1Id = res.data.user.id;
    });

    test('signup rejects duplicate username with 409 Conflict', async () => {
      const res = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'ALICE_WRITER', password: 'AnotherPassword123!' }
      });
      assert.equal(res.status, 409);
      assert.equal(res.data.error, 'That username is already taken');
    });

    test('register second test user (bob_reader)', async () => {
      const res = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'bob_reader', password: 'BobPassword123!' }
      });
      assert.equal(res.status, 201);
      user2Cookie = res.cookie;
      user2Id = res.data.user.id;
    });

    test('/auth/me returns signed-in user with valid session cookie', async () => {
      const res = await makeRequest('GET', '/api/auth/me', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.user.username, 'alice_writer');
      assert.equal(res.data.user.id, user1Id);
    });

    test('login with incorrect password fails with 401', async () => {
      const res = await makeRequest('POST', '/api/auth/login', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'alice_writer', password: 'WrongPassword!' }
      });
      assert.equal(res.status, 401);
      assert.equal(res.data.error, 'Username or password is incorrect');
    });

    test('login with correct credentials succeeds and returns session', async () => {
      const res = await makeRequest('POST', '/api/auth/login', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'alice_writer', password: 'SecurePassword123!' }
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.user.username, 'alice_writer');
      assert.ok(res.cookie);
      user1Cookie = res.cookie;
    });

    test('logout invalidates session and clears cookie', async () => {
      const tempRes = await makeRequest('POST', '/api/auth/signup', {
        headers: { origin: 'http://localhost:5173' },
        body: { username: 'temp_user', password: 'TempPassword123!' }
      });
      const tempCookie = tempRes.cookie;

      const logoutRes = await makeRequest('POST', '/api/auth/logout', {
        headers: { origin: 'http://localhost:5173' },
        cookie: tempCookie
      });
      assert.equal(logoutRes.status, 200);

      const meRes = await makeRequest('GET', '/api/auth/me', {
        headers: { origin: 'http://localhost:5173' },
        cookie: tempCookie
      });
      assert.equal(meRes.status, 200);
      assert.deepEqual(meRes.data, { user: null });
    });
  });

  describe('3. Blog CRUD Operations', () => {
    test('creating blog without authentication returns 401', async () => {
      const res = await makeRequest('POST', '/api/blogs', {
        headers: { origin: 'http://localhost:5173' },
        body: { title: 'Unauthorized', content: 'Should fail' }
      });
      assert.equal(res.status, 401);
    });

    test('creating blog with missing title/content returns 400', async () => {
      const res = await makeRequest('POST', '/api/blogs', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: { title: '', content: '' }
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.error, 'Title and content are required');
    });

    test('creating blog with valid content succeeds (201)', async () => {
      const res = await makeRequest('POST', '/api/blogs', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: {
          title: 'Mastering React and Express',
          content: '<p>A deep dive into architecture and testing.</p>'
        }
      });
      assert.equal(res.status, 201);
      assert.ok(res.data.id);
      assert.equal(res.data.title, 'Mastering React and Express');
      assert.equal(res.data.author, 'alice_writer');
      createdBlogId = res.data.id;
    });

    test('fetch all blogs (public view hides likes/dislikes)', async () => {
      const res = await makeRequest('GET', '/api/blogs', {
        headers: { origin: 'http://localhost:5173' }
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].id, createdBlogId);
      assert.equal(res.data[0].title, 'Mastering React and Express');
      assert.equal(res.data[0].author, 'alice_writer');
      assert.equal(res.data[0].likes, null);
      assert.equal(res.data[0].dislikes, null);
    });

    test('fetch all blogs (authenticated view includes likes/dislikes)', async () => {
      const res = await makeRequest('GET', '/api/blogs', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie
      });
      assert.equal(res.status, 200);
      assert.equal(res.data[0].likes, 0);
      assert.equal(res.data[0].dislikes, 0);
    });

    test('fetch single blog by ID', async () => {
      const res = await makeRequest('GET', `/api/blogs/${createdBlogId}`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.title, 'Mastering React and Express');
      assert.equal(res.data.likes, 0);
    });

    test('fetch single blog with invalid or non-existent ID', async () => {
      const invalidRes = await makeRequest('GET', '/api/blogs/notanumber', {
        headers: { origin: 'http://localhost:5173' }
      });
      assert.equal(invalidRes.status, 400);

      const notFoundRes = await makeRequest('GET', '/api/blogs/999999', {
        headers: { origin: 'http://localhost:5173' }
      });
      assert.equal(notFoundRes.status, 404);
    });

    test('fetch author dashboard blogs (/api/my/blogs)', async () => {
      const aliceBlogs = await makeRequest('GET', '/api/my/blogs', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie
      });
      assert.equal(aliceBlogs.status, 200);
      assert.equal(aliceBlogs.data.length, 1);
      assert.equal(aliceBlogs.data[0].id, createdBlogId);

      const bobBlogs = await makeRequest('GET', '/api/my/blogs', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie
      });
      assert.equal(bobBlogs.status, 200);
      assert.equal(bobBlogs.data.length, 0);
    });

    test('like and dislike interactions increment counts', async () => {
      const likeRes = await makeRequest('PUT', `/api/blogs/${createdBlogId}/like`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie
      });
      assert.equal(likeRes.status, 200);
      assert.equal(likeRes.data.likes, 1);

      const dislikeRes = await makeRequest('PUT', `/api/blogs/${createdBlogId}/dislike`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie
      });
      assert.equal(dislikeRes.status, 200);
      assert.equal(dislikeRes.data.dislikes, 1);
    });

    test('non-author cannot update blog (403 Forbidden)', async () => {
      const res = await makeRequest('PUT', `/api/blogs/${createdBlogId}`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie, // Bob trying to edit Alice's story
        body: { title: 'Unauthorized Modification', content: 'Should fail' }
      });
      assert.equal(res.status, 403);
      assert.equal(res.data.error, 'You can only edit your own stories');
    });

    test('author can update blog successfully', async () => {
      const res = await makeRequest('PUT', `/api/blogs/${createdBlogId}`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: {
          title: 'Mastering React and Express: 2nd Edition',
          content: '<p>Updated content with latest features.</p>'
        }
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.title, 'Mastering React and Express: 2nd Edition');
      assert.equal(res.data.content, '<p>Updated content with latest features.</p>');
    });

    test('non-author cannot delete blog (403 Forbidden)', async () => {
      const res = await makeRequest('DELETE', `/api/blogs/${createdBlogId}`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie
      });
      assert.equal(res.status, 403);
      assert.equal(res.data.error, 'You can only delete your own stories');
    });

    test('author can delete blog successfully', async () => {
      const res = await makeRequest('DELETE', `/api/blogs/${createdBlogId}`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.message, 'Blog deleted successfully');

      // Verify it was deleted
      const checkRes = await makeRequest('GET', `/api/blogs/${createdBlogId}`, {
        headers: { origin: 'http://localhost:5173' }
      });
      assert.equal(checkRes.status, 404);
    });
  });

  describe('4. Comments Feature', () => {
    let commentBlogId;

    before(async () => {
      const res = await makeRequest('POST', '/api/blogs', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: { title: 'Comment Testing Post', content: '<p>Feel free to comment.</p>' }
      });
      commentBlogId = res.data.id;
    });

    test('adding comment without auth returns 401', async () => {
      const res = await makeRequest('POST', `/api/blogs/${commentBlogId}/comments`, {
        headers: { origin: 'http://localhost:5173' },
        body: { text: 'Anonymous comment' }
      });
      assert.equal(res.status, 401);
    });

    test('adding empty comment returns 400', async () => {
      const res = await makeRequest('POST', `/api/blogs/${commentBlogId}/comments`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie,
        body: { text: '   ' }
      });
      assert.equal(res.status, 400);
      assert.match(res.data.error, /Comment must be/);
    });

    test('adding comment to non-existent blog returns 404', async () => {
      const res = await makeRequest('POST', '/api/blogs/999999/comments', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie,
        body: { text: 'Hello' }
      });
      assert.equal(res.status, 404);
    });

    test('adding valid comment succeeds (201)', async () => {
      const res = await makeRequest('POST', `/api/blogs/${commentBlogId}/comments`, {
        headers: { origin: 'http://localhost:5173' },
        cookie: user2Cookie,
        body: { text: 'Fantastic article, highly recommended!' }
      });
      assert.equal(res.status, 201);
      assert.ok(res.data.id);
      assert.equal(res.data.text, 'Fantastic article, highly recommended!');
    });

    test('retrieving comments returns list of comments for the blog', async () => {
      const res = await makeRequest('GET', `/api/blogs/${commentBlogId}/comments`, {
        headers: { origin: 'http://localhost:5173' }
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].text, 'Fantastic article, highly recommended!');
    });
  });

  describe('5. AI Assistant Endpoints Graceful Degradation', () => {
    test('/api/ai/polish returns 503 when GEMINI_API_KEY is not configured', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const res = await makeRequest('POST', '/api/ai/polish', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: { content: '<p>Draft text to polish.</p>' }
      });

      assert.equal(res.status, 503);
      assert.match(res.data.error, /Gemini is not configured/);

      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });

    test('/api/ai/tags returns 503 when GEMINI_API_KEY is not configured', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const res = await makeRequest('POST', '/api/ai/tags', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: { content: '<p>Draft text for tags.</p>' }
      });

      assert.equal(res.status, 503);
      assert.match(res.data.error, /Gemini is not configured/);

      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });

    test('/api/ai/polish rejects empty content with 400', async () => {
      const res = await makeRequest('POST', '/api/ai/polish', {
        headers: { origin: 'http://localhost:5173' },
        cookie: user1Cookie,
        body: { content: '' }
      });
      assert.equal(res.status, 400);
      assert.match(res.data.error, /Content must be/);
    });
  });
});
