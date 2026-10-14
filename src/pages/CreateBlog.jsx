import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill-new";
import DOMPurify from "dompurify";
import "react-quill-new/dist/quill.snow.css";

function CreateBlog() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [tags, setTags] = useState("");
  
  const [isPolishing, setIsPolishing] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  
  const navigate = useNavigate(); 

  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      ["clean"],
    ],
  };

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

  const handleGenerateTags = async () => {
    if (!content || content === "<p><br></p>") {
      alert("Write some content first so the AI knows what tags to make!");
      return;
    }

    setIsGeneratingTags(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      const plainText = tempDiv.innerText; 

      const res = await axios.post("http://localhost:5000/api/ai/tags", { content: plainText });
      setTags(res.data.tags);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "AI failed to generate tags.");
    }
    setIsGeneratingTags(false);
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
    formData.append("image", image);

    try {
      await axios.post("http://localhost:5000/api/blogs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Blog Created ✅");
      navigate("/"); 
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Error creating blog. Please try again.");
      if (error.response?.status === 401) navigate("/login?next=%2Fcreate");
    }
  };

  return (
    <div className="form-container create-blog-page">
      <div className="page-header">
        <h2>Write a New Story</h2>
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
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              required
            />
          </div>

          <div className="sidebar-group">
            <label>Tags</label>
            <input
              type="text"
              placeholder="e.g. coding, tutorial"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{ marginBottom: "10px" }}
            />
            <button 
              type="button" 
              className="btn-ai-tags"
              onClick={handleGenerateTags}
              disabled={isGeneratingTags}
            >
              {isGeneratingTags ? "🏷️ Thinking..." : "🏷️ Auto-Generate Tags"}
            </button>
          </div>

          <div className="sidebar-footer">
            <button type="submit" className="btn-publish">Publish Blog</button>
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
              placeholder="Start writing your masterpiece here..."
            />
          </div>
        </div>

      </form>
    </div>
  );
}

export default CreateBlog;