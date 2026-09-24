import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">

      <div className="footer-container">

        {/* Brand */}
        <div className="footer-column footer-brand">
          <img
            src="/tech-mart-logo.png"
            alt="TechMart"
            className="footer-logo"
          />

          <p>
            Your trusted destination for quality
            electronics, gadgets and technology products.
          </p>

          <div className="footer-socials">
            <a href="#" aria-label="Facebook">
              Facebook
            </a>

            <a href="#" aria-label="Instagram">
              Instagram
            </a>

            <a href="#" aria-label="YouTube">
              YouTube
            </a>
          </div>
        </div>


        {/* Quick Links */}
        <div className="footer-column">
          <h3>Quick Links</h3>

          <Link to="/">Home</Link>

          <Link to="/search">Products</Link>

          <Link to="/cart">Cart</Link>

          <Link to="/my-orders">My Orders</Link>
        </div>


        {/* Customer Service */}
        <div className="footer-column">
          <h3>Customer Service</h3>

          <a href="#">Contact Us</a>

          <a href="#">Privacy Policy</a>

          <a href="#">Terms & Conditions</a>

          <a href="#">Return & Refund Policy</a>
        </div>


        {/* Contact */}
        <div className="footer-column">
          <h3>Contact Us</h3>

          <p>
            📍 Dhaka, Bangladesh
          </p>

          <p>
            📞 +880 1XXX-XXXXXX
          </p>

          <p>
            ✉ support@techmart.com
          </p>

          <p>
            🕒 Sat - Thu: 9:00 AM - 8:00 PM
          </p>
        </div>

      </div>


      {/* Bottom */}
      <div className="footer-bottom">

        <p>
          © {new Date().getFullYear()} TechMart.
          All rights reserved.
        </p>

        <p>
          Designed & Developed for TechMart
        </p>

      </div>

    </footer>
  )
}

export default Footer