import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function MyBlogs() {
  const [blogs, setBlogs] = useState([]);

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/my/blogs");
      setBlogs(res.data);
    } catch (error) {
      console.error("Error fetching blogs:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this blog?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/blogs/${id}`);
      fetchBlogs(); // Refresh the list so the card disappears
    } catch (error) {
      console.error("Error deleting blog:", error);
      alert("Failed to delete the blog.");
    }
  };

  // Calculate total stats for the top overview
  const totalLikes = blogs.reduce((sum, blog) => sum + (blog.likes || 0), 0);
  const totalDislikes = blogs.reduce((sum, blog) => sum + (blog.dislikes || 0), 0);

  return (
    <div className="dashboard-container">
      
      {/* --- Top Header & Stats --- */}
      <div className="dashboard-header">
        <div className="header-titles">
          <h2>My Blogs</h2>
          <p>Manage your published stories and track your performance.</p>
        </div>
        
        <div className="dashboard-stats-overview">
          <div className="stat-box">
            <span className="stat-number">{blogs.length}</span>
            <span className="stat-label">Published</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{totalLikes}</span>
            <span className="stat-label">Total Likes 👍</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{totalDislikes}</span>
            <span className="stat-label">Dislikes 👎</span>
          </div>
        </div>
      </div>

      {/* --- The Blogs Grid --- */}
      <div className="dashboard-grid">
        {blogs.length === 0 ? (
          <div className="empty-dashboard">
            <p>You haven't published anything yet!</p>
            <Link to="/create" className="btn-write-first">Write Your First Blog</Link>
          </div>
        ) : null}

        {blogs.map((blog) => (
          <div key={blog.id} className="dashboard-card">
            
            <div className="dash-card-image">
              {blog.image ? (
                <img src={`http://localhost:5000/uploads/${encodeURIComponent(blog.image)}`} alt={blog.title} />
              ) : (
                <div className="article-image-placeholder" aria-label="No cover image" />
              )}
              <div className="dash-card-stats">
                <span>👍 {blog.likes || 0}</span>
                <span>👎 {blog.dislikes || 0}</span>
              </div>
            </div>

            <div className="dash-card-content">
              <h3>{blog.title}</h3>
              
              <div className="dash-card-actions">
                <Link to={`/blog/${blog.id}`} className="btn-view">👁️ View</Link>
                <Link to={`/edit/${blog.id}`} className="btn-edit">✏️ Edit</Link>
                <button onClick={() => handleDelete(blog.id)} className="btn-delete">🗑️</button>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

export default MyBlogs;