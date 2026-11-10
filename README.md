# Commonplace — Modern Full-Stack Blog Platform

A modern, fast, and feature-rich full-stack blogging platform built with **React 19**, **Vite**, **Express 5**, **SQLite**, and **Google Gemini AI**.

---

## ✨ Features

- **Rich Text Authoring**: Write and format stories with a WYSIWYG editor powered by `react-quill-new` and sanitized with `DOMPurify` to prevent XSS.
- **AI-Powered Writing Assistant**:
  - **AI Polish**: Improve grammar, clarity, and tone while preserving formatting and embedded media.
  - **Auto Tag Generator**: Generate relevant topic tags directly from your article content.
- **Engagement & Community**:
  - Like & dislike reactions with atomic counts.
  - Discussion and comments section on every post.
  - Next & Previous article navigation.
- **Author Dashboard**: Manage, edit, and delete your published stories in one dedicated view.
- **Secure Authentication**:
  - Cryptographic password hashing with `scrypt` and unique salts.
  - HttpOnly cookie-based session tokens.
  - Strict origin validation and CORS security.
- **Cover Image Uploads**: Local image storage with file type filtering (JPEG, PNG, WebP, GIF, AVIF) and size limits via Multer.
- **Automated Test Suite**: 32 unit and integration tests using Node's built-in test runner (`node:test`).

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Editor**: [react-quill-new](https://github.com/visualjerk/react-quill-new)
- **Sanitization**: [DOMPurify](https://github.com/cure53/DOMPurify)
- **HTTP Client**: [Axios](https://axios-http.com/)

### Backend
- **Server**: [Express 5](https://expressjs.com/)
- **Database**: [SQLite](https://www.sqlite.org/) via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
- **File Uploads**: [Multer](https://github.com/expressjs/multer)
- **AI Integration**: [Google Gemini API](https://ai.google.dev/) (`gemini-3.5-flash-lite`)

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended, tested on Node 24)
- **npm** or **pnpm**

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/pawan363/blogging_website.git
cd blogging_website
npm install
```

### 3. Environment Variables
Copy `.env.example` to create your `.env` file:
```bash
cp .env.example .env
```
Configure your environment variables in `.env`:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```
> **Tip:** You can obtain a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 4. Running Locally

Start the backend API server:
```bash
npm run server
```
*API will run at `http://localhost:5000`.*

In a separate terminal, start the frontend development server:
```bash
npm run dev
```
*Open [http://localhost:5173](http://localhost:5173) in your browser.*

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```
The test suite covers:
- **Security & CORS**: Allowed/disallowed origins on protected routes.
- **Authentication**: Validation, signup, duplicate username prevention, login, session cookies, and logout.
- **Blog CRUD**: Authorization checks, creating, reading, updating, deleting, and engagement actions (likes/dislikes).
- **Comments**: Permissions, input constraints, and retrieval.
- **AI Endpoints**: Graceful degradation and error handling when credentials are missing or payloads are invalid.

To build the frontend for production:
```bash
npm run build
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/signup` | Create a new user account | No |
| `POST` | `/api/auth/login` | Sign in with credentials | No |
| `POST` | `/api/auth/logout` | Revoke session and clear cookie | Yes |
| `GET` | `/api/auth/me` | Get current authenticated user | No |

### Blogs
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/blogs` | List all blogs (public feed) | No |
| `GET` | `/api/blogs/:id` | Get single blog details | No |
| `GET` | `/api/my/blogs` | Get stories created by current author | Yes |
| `POST` | `/api/blogs` | Create a new blog with optional cover image | Yes |
| `PUT` | `/api/blogs/:id` | Update an existing blog (author only) | Yes |
| `DELETE`| `/api/blogs/:id` | Delete a blog (author only) | Yes |
| `PUT` | `/api/blogs/:id/:type` | Like or dislike an article (`type`: `like`/`dislike`) | Yes |

### Comments
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/blogs/:id/comments` | List all comments on an article | No |
| `POST` | `/api/blogs/:id/comments` | Post a comment on an article | Yes |

### AI Assistant
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/ai/polish` | Polish article content using Gemini AI | Yes |
| `POST` | `/api/ai/tags` | Auto-generate tags using Gemini AI | Yes |

---

## 📁 Project Structure

```text
blogging_website/
├── config/
│   └── db.js            # SQLite database initialization & migrations
├── routes/
│   └── blogRoutes.js    # API route handlers & Gemini AI integration
├── src/
│   ├── components/      # Navbar, Footer, and shared UI components
│   ├── pages/           # Pages (Feed, SingleBlog, CreateBlog, EditBlog, MyBlogs, Auth)
│   ├── AuthContext.jsx  # Client authentication state & provider
│   ├── App.jsx          # Router & layout definition
│   └── main.jsx         # React application entry point
├── tests/
│   └── api.test.js      # Automated backend API test suite
├── uploads/             # Uploaded cover images directory
├── .env.example         # Template for environment variables
├── server.js            # Express server entry point
├── vite.config.mjs      # Vite build configuration
└── package.json         # Scripts and dependencies
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
