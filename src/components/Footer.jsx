import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import "./Footer.css";

function Footer() {
  return (
    <footer className="site-footer">
      <Link to="/" className="footer-brand">
        <BookOpen size={17} />
        Commonplace
      </Link>
      <span>A little more room for good ideas.</span>
      <span className="footer-copyright">Made for readers and writers</span>
    </footer>
  );
}

export default Footer;
