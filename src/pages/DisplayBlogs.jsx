import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Grid2X2, List, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_URL = "http://localhost:5000";

function formatDate(value) {
  if (!value) return "Recently published";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently published"
    : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function excerpt(html, length = 150) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const text = doc.body.textContent || "";
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

function readingTime(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const wordCount = (doc.body.textContent || "").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 220))} min read`;
}

function BlogImage({ blog, className = "" }) {
  if (!blog.image) {
    return <div className={`article-image-placeholder ${className}`} aria-label="No cover image" />;
  }

  return (
    <img
      className={className}
      src={`${API_URL}/uploads/${encodeURIComponent(blog.image)}`}
      alt=""
      loading="lazy"
    />
  );
}

function DisplayBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    axios.get(`${API_URL}/api/blogs`)
      .then((res) => {
        if (isCurrent) setBlogs(res.data);
      })
      .catch((error) => {
        console.error("Error fetching blogs:", error);
        if (isCurrent) setHasError(true);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  const filteredBlogs = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return blogs;
    return blogs.filter((blog) => (
      blog.title.toLowerCase().includes(searchLower)
      || excerpt(blog.content, Number.MAX_SAFE_INTEGER).toLowerCase().includes(searchLower)
    ));
  }, [blogs, searchTerm]);

  const featuredBlog = searchTerm.trim() ? null : filteredBlogs[0];
  const remainingBlogs = featuredBlog
    ? filteredBlogs.filter((blog) => blog.id !== featuredBlog.id)
    : filteredBlogs;

  return (
    <div className="blog-feed-container">
      <section className="feed-hero">
        <div className="feed-hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> An independent space for ideas</span>
          <h1>Good ideas deserve<br />a <span>place to grow.</span></h1>
          <p>Thoughtful reads, personal stories, and fresh perspectives from people who have something to say.</p>
          <a href="#stories" className="hero-scroll-link">Explore the latest <ArrowRight size={16} /></a>
        </div>
        <div className="feed-hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-note note-one">Ideas in progress</div>
          <div className="art-note note-two">Read. Reflect. Repeat.</div>
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">✳</span>
        </div>
        <div className="hero-bottom-rule">
          <span>Stories for your curious side</span>
          <span>01 — Discover</span>
        </div>
      </section>

      <section className="stories-section" id="stories">
        <div className="section-heading">
          <div>
            <span className="eyebrow">The reading room</span>
            <h2>Fresh from the page</h2>
            <p>Find a new perspective to take with you.</p>
          </div>
          <span className="story-count">{filteredBlogs.length} {filteredBlogs.length === 1 ? "story" : "stories"}</span>
        </div>

        <div className="feed-toolbar">
          <label className="search-container">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search stories, topics, or ideas…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="search-bar"
              aria-label="Search stories"
            />
          </label>
          <div className="view-toggle-container" aria-label="Article layout">
            <button
              type="button"
              className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <Grid2X2 size={17} />
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="feed-message"><span className="loading-dot" /> Gathering the latest stories…</div>
        ) : hasError ? (
          <div className="feed-message feed-error">We couldn’t load the stories just now. Please refresh and try again.</div>
        ) : filteredBlogs.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-feed-mark"><Search size={22} /></div>
            <h3>{searchTerm ? "No stories found" : "Your next favorite read starts here."}</h3>
            <p>{searchTerm ? `Try a different search for “${searchTerm}”.` : "Be the first to share an idea with the community."}</p>
            {!searchTerm && <Link to="/create" className="text-link">Write the first story <ArrowRight size={15} /></Link>}
          </div>
        ) : (
          <>
            {featuredBlog && (
              <Link to={`/blog/${featuredBlog.id}`} className="featured-article">
                <div className="featured-image-wrap">
                  <BlogImage blog={featuredBlog} className="featured-image" />
                  <span className="featured-stamp">Featured story</span>
                </div>
                <div className="featured-copy">
                  <span className="article-kicker">A story to begin with</span>
                  <h3>{featuredBlog.title}</h3>
                  <p>{excerpt(featuredBlog.content, 230)}</p>
                  <div className="article-meta">
                    <span>{formatDate(featuredBlog.created_at)}</span>
                    <span className="meta-divider" />
                    <span>{readingTime(featuredBlog.content)}</span>
                    <span className="featured-read-link">Read story <ArrowRight size={15} /></span>
                  </div>
                </div>
              </Link>
            )}

            {remainingBlogs.length > 0 && (
              <div className={`modern-grid ${viewMode === "list" ? "modern-list" : ""}`}>
                {remainingBlogs.map((blog) => (
                  <Link to={`/blog/${blog.id}`} key={blog.id} className="modern-card">
                    <div className="card-image-wrapper">
                      <BlogImage blog={blog} className="article-card-image" />
                      <span className="card-image-label">From the community</span>
                    </div>
                    <div className="card-content">
                      <span className="article-kicker">{formatDate(blog.created_at)}</span>
                      <h3>{blog.title}</h3>
                      <p>{excerpt(blog.content)}</p>
                      <span className="read-more">Read story <ArrowRight size={15} /></span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default DisplayBlogs;
