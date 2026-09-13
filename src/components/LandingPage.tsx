import React, { useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

interface LandingPageProps {
  onLaunchDashboard: () => void;
  onOpenAuth: () => void;
  currentUser: FirebaseUser | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
  userUsername: string;
  onViewPublicProfile: (username?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchDashboard,
  onOpenAuth,
  currentUser,
  isDarkMode,
  toggleTheme,
  userUsername,
  onViewPublicProfile,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [interactiveCategory, setInteractiveCategory] = useState<string>('All');
  const [copiedDemo, setCopiedDemo] = useState<string | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const handleCopyDemo = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedDemo(id);
    setTimeout(() => setCopiedDemo(null), 2000);
  };

  const sampleLinks = [
    {
      id: 'demo-1',
      title: 'GitHub Repository',
      category: 'Work',
      url: 'https://github.com',
      desc: 'Code hosting, pull requests, and CI/CD pipelines',
      icon: 'fa-brands fa-github',
      favorite: true,
    },
    {
      id: 'demo-2',
      title: 'DevDocs API Documentation',
      category: 'Tools',
      url: 'https://devdocs.io',
      desc: 'Fast, offline and mobile-friendly API documentation reader',
      icon: 'fa-solid fa-code',
      favorite: true,
    },
    {
      id: 'demo-3',
      title: 'Figma Design Workspace',
      category: 'Work',
      url: 'https://figma.com',
      desc: 'Collaborative interface design tool for product teams',
      icon: 'fa-solid fa-pen-nib',
      favorite: false,
    },
    {
      id: 'demo-4',
      title: 'Hacker News Community',
      category: 'Reading',
      url: 'https://news.ycombinator.com',
      desc: 'Tech news, startups, and developer discussions',
      icon: 'fa-solid fa-newspaper',
      favorite: false,
    },
  ];

  const filteredDemoLinks = interactiveCategory === 'All'
    ? sampleLinks
    : sampleLinks.filter((l) => l.category === interactiveCategory);

  const faqs = [
    {
      q: 'What is LinkManager.in and how does it work?',
      a: 'LinkManager.in is an all-in-one bookmark and link manager that replaces cluttered browser bookmarks. It lets you organize web links into intuitive categories, reorder them with drag and drop, generate instant QR codes, export collections to PDF, and even host a personal public page (linkmanager.in/@username) to share your curated resources.',
    },
    {
      q: 'Is LinkManager.in completely free to use?',
      a: 'Yes! LinkManager.in is 100% free to use. You can jump straight into the dashboard without an account, or sign in with your email or Google account to enable cloud sync across all your phones, tablets, and desktop computers.',
    },
    {
      q: 'How does the custom public profile page work?',
      a: 'Every user gets their own clean, customizable public URL (for example, linkmanager.in/josephsoren). You have granular control over which links and categories are public or private. You can also share category-specific pages (e.g. linkmanager.in/username/exam-links) or generate instant QR codes.',
    },
    {
      q: 'Can I export my bookmarks to PDF or JSON backup?',
      a: 'Yes. With a single click, you can generate a beautifully formatted PDF document listing your bookmarks with clickable URLs and category headers, or export a complete JSON backup file to import anywhere.',
    },
    {
      q: 'Does it work smoothly on mobile devices?',
      a: 'Absolutely. LinkManager.in is mobile-optimized with a touch-friendly category ribbon, quick search, full-width cards, and one-tap QR sharing designed specifically for small screens.',
    },
    {
      q: 'How is LinkManager.in different from traditional browser bookmarks?',
      a: 'Browser bookmarks are locked to a specific browser or machine, lack visual thumbnails, have no built-in QR generation, and cannot be shared as public link hubs or exported cleanly to PDF. LinkManager.in is cloud-synced, cross-browser, cross-device, and sharable with the world.',
    },
  ];

  return (
    <div className="landing-page-container" id="landingPage">
      {/* Top Navigation */}
      <header className="landing-nav" id="landingNav">
        <div className="landing-nav-inner">
          <div className="logo" onClick={onLaunchDashboard} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-link logo-icon"></i>
            <span>
              LinkManager<span className="domain">.in</span>
            </span>
          </div>

          <nav className="landing-nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#demo" className="nav-link">Live Preview</a>
            <a href="#use-cases" className="nav-link">Use Cases</a>
            <a href="#comparison" className="nav-link">Comparison</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title="Toggle Dark/Light Mode"
              id="landingThemeBtn"
            >
              <i className={isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
            </button>

            {currentUser ? (
              <button
                id="landingGoDashboardBtn"
                className="btn btn-primary"
                onClick={onLaunchDashboard}
              >
                <i className="fa-solid fa-table-columns"></i> Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  id="landingSignInBtn"
                  className="btn btn-secondary"
                  onClick={onOpenAuth}
                >
                  <i className="fa-solid fa-user"></i> Sign In
                </button>
                <button
                  id="landingGetStartedBtn"
                  className="btn btn-primary"
                  onClick={onLaunchDashboard}
                >
                  Open Dashboard <i className="fa-solid fa-arrow-right"></i>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero" id="home">
        <div className="landing-hero-content">
          <div className="landing-badge">
            <i className="fa-solid fa-sparkles"></i> The Modern Cloud Bookmark & Link Manager
          </div>
          <h1 className="landing-title">
            All Your Links in One Place.<br />
            <span className="landing-gradient-text">Organized, Sharable, Everywhere.</span>
          </h1>
          <p className="landing-subtitle">
            Say goodbye to cluttered browser tabs and lost bookmarks. <strong>LinkManager.in</strong> gives you
            a lightning-fast dashboard with drag-and-drop categorization, instant QR code sharing, PDF exports,
            and customizable public profile pages.
          </p>

          <div className="landing-hero-cta">
            <button
              id="heroLaunchBtn"
              className="btn btn-primary hero-btn-lg"
              onClick={onLaunchDashboard}
            >
              <i className="fa-solid fa-rocket"></i> Launch Dashboard Free
            </button>
            <button
              id="heroPublicProfileBtn"
              className="btn btn-secondary hero-btn-lg"
              onClick={() => onViewPublicProfile(userUsername)}
            >
              <i className="fa-solid fa-globe"></i> View Public Profile
            </button>
          </div>

          <div className="landing-perks-row">
            <span><i className="fa-solid fa-check-circle"></i> 100% Free Forever</span>
            <span><i className="fa-solid fa-check-circle"></i> Firebase Cloud Sync</span>
            <span><i className="fa-solid fa-check-circle"></i> Instant QR Codes</span>
            <span><i className="fa-solid fa-check-circle"></i> 1-Click PDF & JSON Export</span>
          </div>
        </div>

        {/* Live Interactive Product Demo Frame */}
        <div className="landing-demo-wrapper" id="demo">
          <div className="mock-browser">
            <div className="mock-browser-header">
              <div className="mock-browser-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="mock-browser-address">
                <i className="fa-solid fa-lock"></i> https://linkmanager.in/{userUsername || 'josephsoren'}
              </div>
              <div className="mock-browser-badge">Live Interactive Preview</div>
            </div>

            <div className="mock-browser-body">
              {/* Category Ribbon in Mockup */}
              <div className="mock-category-ribbon">
                {['All', 'Work', 'Tools', 'Reading'].map((cat) => (
                  <button
                    key={cat}
                    className={`mock-cat-btn ${interactiveCategory === cat ? 'active' : ''}`}
                    onClick={() => setInteractiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sample Cards Grid */}
              <div className="mock-cards-grid">
                {filteredDemoLinks.map((item) => (
                  <div key={item.id} className="mock-link-card">
                    <div className="mock-card-icon">
                      <i className={item.icon}></i>
                    </div>
                    <div className="mock-card-info">
                      <div className="mock-card-header">
                        <h4>{item.title}</h4>
                        {item.favorite && (
                          <i className="fa-solid fa-star" style={{ color: '#f59e0b', fontSize: '0.8rem' }}></i>
                        )}
                      </div>
                      <p className="mock-card-desc">{item.desc}</p>
                      <div className="mock-card-meta">
                        <span className="mock-tag">{item.category}</span>
                        <span className="mock-domain">{new URL(item.url).hostname}</span>
                      </div>
                    </div>
                    <div className="mock-card-actions">
                      <button
                        className="btn-icon-subtle"
                        title="Copy link"
                        onClick={() => handleCopyDemo(item.url, item.id)}
                      >
                        <i className={copiedDemo === item.id ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-icon-subtle"
                        title="Open external URL"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mock-footer-bar">
                <span>Try clicking categories above or copy links instantly!</span>
                <button className="btn btn-primary btn-sm" onClick={onLaunchDashboard}>
                  Open Full Dashboard →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="landing-section" id="features">
        <div className="section-header text-center">
          <h2 className="section-title">Built for Speed, Privacy & Accessibility</h2>
          <p className="section-subtitle">
            Everything you need to organize your daily internet presence and share curated resources.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon bg-blue">
              <i className="fa-solid fa-folder-tree"></i>
            </div>
            <h3>Smart Categorization & Drag-and-Drop</h3>
            <p>
              Group links by project, client, or topic (Work, Tools, Reading, Social, or unlimited custom categories).
              Reorder your links naturally with fluid drag-and-drop.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-indigo">
              <i className="fa-solid fa-globe"></i>
            </div>
            <h3>Personal Public Page (/@username)</h3>
            <p>
              Get a branded public hub like <code>linkmanager.in/username</code>. Use it as your personal bio link,
              portfolio index, or curated reading list for friends and colleagues.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-purple">
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <h3>One-Tap QR Code Generator</h3>
            <p>
              Generate high-resolution QR codes for any individual bookmark, entire category collections, or your public profile.
              Scan with your phone camera for instant mobile handoff.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-red">
              <i className="fa-solid fa-file-pdf"></i>
            </div>
            <h3>PDF Export & JSON Backups</h3>
            <p>
              Never worry about vendor lock-in. Generate print-ready PDF catalogs of your bookmarks or download full JSON
              backups with a single click.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-emerald">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h3>Granular Privacy Controls</h3>
            <p>
              Choose which links are public and which remain private. Keep work documents and personal credentials strictly
              confidential while sharing only what you want.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-amber">
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <h3>Lightning Fast Search & Tagging</h3>
            <p>
              Find bookmarks in milliseconds with instant keyboard search across titles, URLs, descriptions, and custom
              category tags.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="landing-section bg-alt" id="use-cases">
        <div className="section-header text-center">
          <h2 className="section-title">Designed for Every Kind of Workflow</h2>
          <p className="section-subtitle">
            From solo creators to busy engineering teams, LinkManager.in streamlines your internet experience.
          </p>
        </div>

        <div className="use-cases-grid">
          <div className="use-case-card">
            <div className="use-case-tag">For Developers</div>
            <h3>Developer & Engineering Hub</h3>
            <p>
              Store API docs, GitHub repositories, cloud console consoles, and local dev environments in one quick-access
              dashboard.
            </p>
            <ul>
              <li><i className="fa-solid fa-check"></i> Instant search across code tools</li>
              <li><i className="fa-solid fa-check"></i> Category share links for team onboarding</li>
            </ul>
          </div>

          <div className="use-case-card">
            <div className="use-case-tag">For Creators</div>
            <h3>Creators & Freelancers</h3>
            <p>
              Replace bulky link-in-bio services with a clean, fast public profile featuring your portfolio, social profiles,
              and recent work.
            </p>
            <ul>
              <li><i className="fa-solid fa-check"></i> Custom username URL (/@username)</li>
              <li><i className="fa-solid fa-check"></i> Scannable QR codes for business cards</li>
            </ul>
          </div>

          <div className="use-case-card">
            <div className="use-case-tag">For Students</div>
            <h3>Students & Researchers</h3>
            <p>
              Organize syllabus readings, research papers, assignment portals, and study guides. Export clean PDF bibliographies
              anytime.
            </p>
            <ul>
              <li><i className="fa-solid fa-check"></i> Export bookmarked references to PDF</li>
              <li><i className="fa-solid fa-check"></i> Share study playlists with classmates</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="landing-section" id="comparison">
        <div className="section-header text-center">
          <h2 className="section-title">How LinkManager.in Compares</h2>
          <p className="section-subtitle">
            See why power users switch from standard browser bookmarks to LinkManager.in.
          </p>
        </div>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Standard Browser Bookmarks</th>
                <th>Generic Link-in-Bio</th>
                <th className="highlight-column">LinkManager.in</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Cross-Device & Cloud Sync</strong></td>
                <td>Locked to single browser</td>
                <td>Yes</td>
                <td className="highlight-column"><strong>Yes (Firebase Real-Time)</strong></td>
              </tr>
              <tr>
                <td><strong>Drag & Drop Reordering</strong></td>
                <td>Clunky & limited</td>
                <td>Basic</td>
                <td className="highlight-column"><strong>Fluid & Instant</strong></td>
              </tr>
              <tr>
                <td><strong>Public Profile URL</strong></td>
                <td>None</td>
                <td>Yes (often paid for custom)</td>
                <td className="highlight-column"><strong>Free /@username Hub</strong></td>
              </tr>
              <tr>
                <td><strong>1-Click QR Code Generator</strong></td>
                <td>None</td>
                <td>Paid upgrade</td>
                <td className="highlight-column"><strong>Built-in Free</strong></td>
              </tr>
              <tr>
                <td><strong>Export to PDF & JSON</strong></td>
                <td>HTML export only</td>
                <td>None</td>
                <td className="highlight-column"><strong>Formatted PDF + JSON</strong></td>
              </tr>
              <tr>
                <td><strong>Public vs. Private Visibility</strong></td>
                <td>All private</td>
                <td>All public</td>
                <td className="highlight-column"><strong>Granular Per-Link Toggle</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section (SEO-Rich) */}
      <section className="landing-section bg-alt" id="faq">
        <div className="section-header text-center">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Everything you need to know about getting started with LinkManager.in.
          </p>
        </div>

        <div className="faq-container">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className={`faq-item ${activeFaq === idx ? 'open' : ''}`}
              onClick={() => toggleFaq(idx)}
            >
              <button className="faq-question">
                <span>{faq.q}</span>
                <i className={`fa-solid ${activeFaq === idx ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              </button>
              {activeFaq === idx && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="landing-cta-banner">
        <div className="landing-cta-inner">
          <h2>Start Organizing Your Digital World Today</h2>
          <p>
            Experience a cleaner, faster, and more accessible bookmark experience. No credit card required.
          </p>
          <div className="landing-cta-buttons">
            <button
              className="btn btn-primary hero-btn-lg"
              onClick={onLaunchDashboard}
              id="ctaLaunchBtn"
            >
              <i className="fa-solid fa-bolt"></i> Open Dashboard Now
            </button>
            <button
              className="btn btn-secondary hero-btn-lg"
              onClick={onOpenAuth}
              id="ctaAuthBtn"
            >
              <i className="fa-solid fa-user-plus"></i> Create Free Account
            </button>
          </div>
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="logo" onClick={onLaunchDashboard} style={{ cursor: 'pointer' }}>
              <i className="fa-solid fa-link logo-icon"></i>
              <span>LinkManager<span className="domain">.in</span></span>
            </div>
            <p>The modern bookmark and link management platform for students, developers, and professionals.</p>
          </div>

          <div className="landing-footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <button className="footer-link-btn" onClick={onLaunchDashboard}>Dashboard</button>
              <a href="#features" className="footer-link-btn">Features</a>
              <a href="#comparison" className="footer-link-btn">Comparison</a>
              <a href="#faq" className="footer-link-btn">FAQ</a>
            </div>

            <div className="footer-col">
              <h4>Resources</h4>
              <button className="footer-link-btn" onClick={() => onViewPublicProfile(userUsername)}>Public Page</button>
              <button className="footer-link-btn" onClick={onOpenAuth}>Firebase Sign In</button>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="footer-link-btn">GitHub</a>
            </div>

            <div className="footer-col">
              <h4>Platform</h4>
              <span className="footer-meta-item">Free & Open Access</span>
              <span className="footer-meta-item">Firebase Cloud Firestore</span>
              <span className="footer-meta-item">SSL Encrypted</span>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <p>© {new Date().getFullYear()} LinkManager.in. All rights reserved. Fast, secure cloud link management.</p>
          <div className="footer-bottom-links">
            <button className="footer-link-btn" onClick={onLaunchDashboard}>Launch App</button>
            <button className="footer-link-btn" onClick={toggleTheme}>
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
