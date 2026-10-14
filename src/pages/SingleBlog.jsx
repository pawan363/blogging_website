import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import { useAuth } from "../AuthContext";

function SingleBlog() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [blog, setBlog] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  
  // 🔥 New States for Comments & Navigation
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [prevBlog, setPrevBlog] = useState(null);
  const [nextBlog, setNextBlog] = useState(null);

  useEffect(() => {
    // Scroll to top whenever the ID changes (when user clicks Next/Prev)
    window.scrollTo(0, 0); 
    
    fetchBlogData();
    fetchComments();
    fetchAdjacentBlogs();

    const votedBlogs = JSON.parse(localStorage.getItem("votedBlogs")) || [];
    setHasVoted(votedBlogs.includes(id));
  }, [id]); // This effect runs every time the URL 'id' changes!

  const fetchBlogData = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/blogs/${id}`);
      setBlog(res.data);
    } catch (error) {
      console.error("Error fetching blog:", error);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/blogs/${id}/comments`);
      setComments(res.data);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchAdjacentBlogs = async () => {
    try {
      // Fetch all blogs to figure out which ones are next/previous
      const res = await axios.get("http://localhost:5000/api/blogs");
      const allBlogs = res.data;
      const currentIndex = allBlogs.findIndex(b => b.id === Number(id));
      
      if (currentIndex > 0) setNextBlog(allBlogs[currentIndex - 1]); // Newer post
      else setNextBlog(null);
      
      if (currentIndex < allBlogs.length - 1) setPrevBlog(allBlogs[currentIndex + 1]); // Older post
      else setPrevBlog(null);

    } catch (error) {
      console.error("Error fetching adjacent blogs:", error);
    }
  };

  const handleInteraction = async (type) => {
    if (hasVoted) return alert("You have already voted on this post!");
    try {
      await axios.put(`http://localhost:5000/api/blogs/${id}/${type}`);
      const votedBlogs = JSON.parse(localStorage.getItem("votedBlogs")) || [];
      votedBlogs.push(id);
      localStorage.setItem("votedBlogs", JSON.stringify(votedBlogs));
      setHasVoted(true);
      fetchBlogData(); 
    } catch (error) {
      console.error("Error recording reaction:", error);
      alert(error.response?.data?.error || "Could not record your reaction.");
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await axios.post(`http://localhost:5000/api/blogs/${id}/comments`, { text: newComment });
      setNewComment(""); // Clear the input box
      fetchComments(); // Refresh the comment list!
    } catch (error) {
      console.error("Error posting comment:", error);
      alert(error.response?.data?.error || "Could not post your comment.");
    }
  };

  if (!blog) return <div className="empty-state">Loading article...</div>;

  return (
    <div className="single-blog-container">
      <Link to="/" className="back-button">← Back to Feed</Link>
      
      <div className="single-blog-header">
        <h1>{blog.title}</h1>
      </div>

      <img src={`http://localhost:5000/uploads/${blog.image}`} alt={blog.title} className="single-blog-hero-image" />
      <div
        className="single-blog-content ql-editor"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.content, { USE_PROFILES: { html: true } }) }}
      />

      {user ? (
        <div className="interaction-bar">
          <button onClick={() => handleInteraction('like')} className={`btn-like ${hasVoted ? 'disabled' : ''}`} disabled={hasVoted}>
            👍 Like ({blog.likes || 0})
          </button>
          <button onClick={() => handleInteraction('dislike')} className={`btn-dislike ${hasVoted ? 'disabled' : ''}`} disabled={hasVoted}>
            👎 Dislike ({blog.dislikes || 0})
          </button>
        </div>
      ) : (
        <p className="auth-prompt">
          <Link to={`/login?next=${encodeURIComponent(`/blog/${id}`)}`}>Sign in</Link> to react to this story.
        </p>
      )}

      {/* 🔥 NEXT / PREVIOUS NAVIGATION */}
      <div className="article-navigation">
        {prevBlog ? (
          <Link to={`/blog/${prevBlog.id}`} className="nav-card prev-card">
            <span>← Previous Article</span>
            <h4>{prevBlog.title}</h4>
          </Link>
        ) : <div className="nav-placeholder"></div>}

        {nextBlog ? (
          <Link to={`/blog/${nextBlog.id}`} className="nav-card next-card">
            <span>Next Article →</span>
            <h4>{nextBlog.title}</h4>
          </Link>
        ) : <div className="nav-placeholder"></div>}
      </div>

      {/* 🔥 COMMENTS SECTION */}
      <div className="comments-section">
        <h3>Discussion ({comments.length})</h3>
        
        {user ? (
          <form onSubmit={handlePostComment} className="comment-form">
            <textarea 
              placeholder="What are your thoughts on this?"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows="3"
              required
            />
            <button type="submit">Post Comment</button>
          </form>
        ) : (
          <p className="auth-prompt">
            <Link to={`/login?next=${encodeURIComponent(`/blog/${id}`)}`}>Sign in</Link> to join the discussion.
          </p>
        )}

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Be the first to start the discussion!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="comment-card">
                <div className="comment-avatar">👤</div>
                <div className="comment-body">
                  <span className="comment-date">Anonymous Reader</span>
                  <p>{comment.text}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

export default SingleBlog;