import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ReactQuill from "react-quill-new";
import DOMPurify from "dompurify";
import "react-quill-new/dist/quill.snow.css";

function EditBlog() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  
  const [isPolishing, setIsPolishing] = useState(false);

  // Quill Toolbar Configuration
  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      ["clean"],
    ],
  };

  // Fetch the existing blog data when the page loads
  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/blogs/${id}`);
        setTitle(res.data.title);
        setContent(res.data.content);
      } catch (error) {
        console.error("Error fetching blog:", error);
      }
    };
    fetchBlog();
  }, [id]);

  // ✨ AI Function: Magic Polish
  const handlePolish = async () => {
    if (!content || content === "<p><br></p>") {
      alert("Write some content first before polishing!");
      return;
    }
    
    setIsPolishing(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      
      const images = tempDiv.querySelectorAll("img");
      const savedImages = [];
      images.forEach((img, index) => {
        savedImages.push(img.src); 
        img.src = `__IMG_${index}__`; 
      });
      
      const res = await axios.post("http://localhost:5000/api/ai/polish", { 
        content: tempDiv.innerHTML 
      });

      const resultDiv = document.createElement("div");
      resultDiv.innerHTML = DOMPurify.sanitize(res.data.polishedContent, { USE_PROFILES: { html: true } });
      
      const resultImages = resultDiv.querySelectorAll("img");
      resultImages.forEach((img, index) => {
        if (savedImages[index]) {
          img.src = savedImages[index]; 
        }
      });

      setContent(resultDiv.innerHTML);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "AI failed to polish the text.");
    }
    setIsPolishing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (content === "" || content === "<p><br></p>") {
        alert("Please write some content for your blog!");
        return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    if (image) formData.append("image", image); // Only append if they chose a new image

    try {
      await axios.put(`http://localhost:5000/api/blogs/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Blog Updated ✅");
      navigate("/my-blogs"); // Send back to dashboard
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Error updating blog. Please try again.");
      if (error.response?.status === 401) navigate(`/login?next=${encodeURIComponent(`/edit/${id}`)}`);
    }
  };

  return (
    <div className="form-container create-blog-page">
      <div className="page-header">
        <h2>Edit Your Story</h2>
      </div>

      <form onSubmit={handleSubmit} className="blog-form create-layout">
        
        {/* ======================================= */}
        {/* LEFT COLUMN (1/4 Width) - Meta Data     */}
        {/* ======================================= */}
        <div className="create-sidebar">
          <div className="sidebar-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="Enter an engaging title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="sidebar-group">
            <label>Cover Image</label>
            <p style={{ fontSize: "0.85rem", color: "#8d99ae", marginBottom: "8px" }}>
              Leave empty to keep your current cover image.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
            />
          </div>

          <div className="sidebar-footer">
            <button type="submit" className="btn-publish">Save Changes</button>
          </div>
        </div>

        {/* ======================================= */}
        {/* RIGHT COLUMN (3/4 Width) - The Editor   */}
        {/* ======================================= */}
        <div className="create-main">
          <div className="editor-header">
            <label>Article Content</label>
            <button 
              type="button" 
              className="btn-magic-polish"
              onClick={handlePolish} 
              disabled={isPolishing}
            >
              {isPolishing ? "✨ Polishing..." : "✨ Magic Polish"}
            </button>
          </div>

          <div className="editor-container">
            <ReactQuill 
              theme="snow" 
              value={content} 
              onChange={setContent} 
              modules={modules}
              placeholder="Edit your masterpiece here..."
            />
          </div>
        </div>

      </form>
    </div>
  );
}

export default EditBlog;