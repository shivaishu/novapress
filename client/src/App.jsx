import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ArrowDown, ArrowLeft, ArrowRight, Bell, Bookmark, Check, Clock3, Flame, Heart, Menu, MessageCircle, Search, Share2, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';

const categories = ['All stories', 'World', 'Technology', 'Business', 'Culture', 'Science', 'Politics'];
const formatDate = (date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));

export default function App() {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [category, setCategory] = useState('All stories');
  const [query, setQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authPage, setAuthPage] = useState(() => window.location.pathname === '/signin');
  const [socialProviders, setSocialProviders] = useState({ google: false });
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('nova-user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('nova-token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [liveSocket, setLiveSocket] = useState(null);
  const refreshRef = useRef(null);

  const refresh = async (signal) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (category !== 'All stories') params.set('category', category);
      if (query.trim()) params.set('q', query.trim());
      params.set('page', String(page)); params.set('limit', '30');
      const response = await fetch(`/api/articles?${params}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load stories.');
      setArticles((current) => page === 1 ? (data.articles || []) : [...current, ...(data.articles || []).filter((item) => !current.some((old) => old._id === item._id))]);
      setPages(data.pages || 1);
    } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setArticles([]); } }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  refreshRef.current = refresh;
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); return () => controller.abort(); }, [category, query, page]);
  useEffect(() => { const id = setTimeout(() => { setPage(1); setQuery(searchDraft.trim()); }, 300); return () => clearTimeout(id); }, [searchDraft]);
  useEffect(() => {
    const onPopState = () => setAuthPage(window.location.pathname === '/signin');
    window.addEventListener('popstate', onPopState);
    fetch('/api/auth/providers').then((r) => r.json()).then(setSocialProviders).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'complete') fetch('/api/auth/oauth/session').then((r) => r.json().then((data) => ({ ok: r.ok, data }))).then(({ ok, data }) => {
      if (!ok) throw new Error(data.message);
      localStorage.setItem('nova-token', data.token); localStorage.setItem('nova-user', JSON.stringify(data.user));
      setToken(data.token); setUser(data.user); setAuthPage(false); history.replaceState({}, '', '/'); setToast(`Welcome back, ${data.user.name.split(' ')[0]}.`);
    }).catch((error) => { history.replaceState({}, '', '/signin'); setToast(error.message || 'Social sign in failed.'); });
    const socialError = params.get('oauthError');
    if (socialError) { history.replaceState({}, '', '/signin'); setToast(socialError); }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => { fetch('/api/categories').then((r) => r.json()).then((data) => { if (data.categories?.length) setCategoryOptions(['All stories', ...data.categories.map((c) => c.name)]); }).catch(() => {}); }, []);
  useEffect(() => {
    const socket = io({ path: '/socket.io', auth: token ? { token } : {} });
    setLiveSocket(socket);
    socket.on('article:published', () => refreshRef.current?.());
    socket.on('article:updated', () => refreshRef.current?.());
    socket.on('article:deleted', () => refreshRef.current?.());
    socket.on('article:comment', (comment) => setSelected((story) => story && String(story._id) === String(comment.articleId) ? { ...story, comments: [...(story.comments || []).filter((item) => String(item._id) !== String(comment._id)), comment] } : story));
    socket.on('article:reaction', (update) => setSelected((story) => story && String(story._id) === String(update.articleId) ? { ...story, likesCount: update.likes, dislikesCount: update.dislikes } : story));
    socket.on('notification:new', (item) => { setNotifications((list) => [item, ...list].slice(0, 30)); setUnreadCount((count) => count + 1); setToast(item.message); });
    return () => { socket.disconnect(); setLiveSocket(null); };
  }, [token]);
  useEffect(() => {
    if (!token) { setUnreadCount(0); return; }
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : null).then((data) => { if (data) setUnreadCount(data.unread || 0); }).catch(() => {});
  }, [token]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2500); return () => clearTimeout(id); }, [toast]);

  const featured = useMemo(() => articles.find((a) => a.featured) || articles[0], [articles]);
  const remaining = articles.filter((a) => a._id !== featured?._id);

  async function authenticate(event) {
    event.preventDefault();
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/auth/${authMode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      localStorage.setItem('nova-token', data.token); localStorage.setItem('nova-user', JSON.stringify(data.user));
      setToken(data.token); setUser(data.user); setAuthOpen(false); setAuthPage(false); history.pushState({}, '', '/'); setToast(`Welcome${authMode === 'register' ? ' to Nova Press' : ' back'}, ${data.user.name.split(' ')[0]}.`);
    } catch (e) { setToast(e.message || 'Could not sign in.'); }
    finally { setAuthBusy(false); }
  }

  function signOut() { localStorage.removeItem('nova-token'); localStorage.removeItem('nova-user'); setToken(null); setUser(null); setToast('You have signed out.'); }
  function openSignIn(mode = 'login') { setAuthMode(mode); setAuthOpen(false); setAuthPage(true); if (location.pathname !== '/signin') history.pushState({}, '', '/signin'); }

  async function openNotifications() {
    if (!token) { openSignIn('login'); setToast('Sign in to view notifications.'); return; }
    try { const response = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setNotifications(data.notifications || []); setUnreadCount(data.unread || 0); setNotificationsOpen(true); }
    catch (e) { setToast(e.message || 'Could not load notifications.'); }
  }

  async function subscribe(event) {
    event.preventDefault(); setNewsletterBusy(true);
    const form = event.currentTarget; const email = new FormData(form).get('email');
    try { const response = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setToast(data.message); form.reset(); }
    catch (e) { setToast(e.message || 'Could not subscribe. Please try again.'); }
    finally { setNewsletterBusy(false); }
  }

  async function reactTo(id, value) {
    if (!token) { openSignIn('login'); setToast('Sign in to react to a story.'); return; }
    try {
      const response = await fetch(`/api/articles/${id}/reactions`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      const updateStory = (story) => story?._id === id ? { ...story, likesCount: data.likes, dislikesCount: data.dislikes, myReaction: data.mine } : story;
      setArticles((list) => list.map((story) => updateStory(story)));
      setSelected(updateStory);
    } catch (e) { setToast(e.message); }
  }

  async function comment(id, body) {
    const response = await fetch(`/api/articles/${id}/comments`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message);
    setSelected((a) => a?._id === id ? { ...a, comments: [...(a.comments || []).filter((item) => String(item._id) !== String(data.comment._id)), data.comment] } : a);
    return data.comment;
  }

  if (authPage) return <AuthPage mode={authMode} setMode={setAuthMode} onSubmit={authenticate} busy={authBusy} onClose={() => { history.pushState({}, '', '/'); setAuthPage(false); }} providers={socialProviders} message={toast} />;

  return <div className="site-shell pulse-shell">
    <div className="pulse-topline"><span><i className="live-dot" /> THE DAILY BRIEFING <b>•</b> {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><span>Independent news. A wider point of view.</span></div>
    <header className="pulse-header" id="top">
      <button className="icon-button mobile-trigger" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
      <a className="pulse-brand" href="#top" onClick={() => { setPage(1); setCategory('All stories'); setQuery(''); }}><span className="pulse-logo">N</span><span>NOVA<span>PRESS</span></span></a>
      <nav className={mobileMenu ? 'pulse-nav open' : 'pulse-nav'}>{categoryOptions.map((item) => <button key={item} className={category === item ? 'pulse-nav-item active' : 'pulse-nav-item'} onClick={() => { setPage(1); setCategory(item); setMobileMenu(false); document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' }); }}>{item === 'All stories' ? 'News' : item}</button>)}</nav>
      <div className="pulse-actions">
        {searchOpen ? <form className="pulse-search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(searchDraft.trim()); setSearchOpen(false); document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' }); }}><input autoFocus placeholder="Search news" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} /><button type="button" onClick={() => { setSearchOpen(false); setPage(1); setSearchDraft(''); setQuery(''); }} aria-label="Close search"><X size={17} /></button></form> : <button className="pulse-search-button" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={18} /></button>}
        {user && <button className="pulse-notifications" onClick={openNotifications} aria-label="Notifications"><Bell size={17} />{unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}</button>}
        {['editor', 'admin'].includes(user?.role) && <><button className="pulse-desk" onClick={() => setDeskOpen(true)}>Desk</button><button className="pulse-write" onClick={() => setEditorOpen(true)}>Write <span>+</span></button></>}
        {user ? <button className="pulse-avatar" onClick={() => setProfileOpen(true)} title="Account settings">{user.name.charAt(0).toUpperCase()}</button> : <button className="pulse-signin" onClick={() => openSignIn('login')}>Sign in <ArrowRight size={14} /></button>}
      </div>
    </header>
    <main className="pulse-main">
      <div className="pulse-ticker"><span><Flame size={14} fill="currentColor" /> BREAKING</span><p>{featured?.title || 'The stories shaping today — updated throughout the day'}</p><button onClick={() => featured && setSelected(featured)}>Read story <ArrowRight size={14} /></button></div>
      <section className="pulse-breaking">
        <div className="pulse-section-heading"><div><span className="pulse-kicker">THE STORIES MAKING TODAY</span><h1>Breaking <em>news</em></h1></div><span className="pulse-updated"><i /> LIVE UPDATES</span></div>
        {loading && !articles.length ? <div className="pulse-breaking-grid"><div className="pulse-skeleton" /><div className="pulse-skeleton" /></div> : featured ? <div className="pulse-breaking-grid">
          <button className="breaking-lead" onClick={() => setSelected(featured)} style={{ backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(19,14,33,.82)), url("${featured.image}")` }}><span className="breaking-tag">{featured.category} <i>•</i> TOP STORY</span><span className="breaking-lead-copy"><small>{formatDate(featured.createdAt)} <i>·</i> {featured.readMinutes || 4} min read</small><b>{featured.title}</b><span>{featured.excerpt}</span><strong>Read story <ArrowRight size={15} /></strong></span></button>
          <div className="breaking-tiles">{articles.filter((a) => a._id !== featured._id).slice(0, 3).map((article, index) => <button className={`breaking-tile tile-${index + 1}`} key={article._id} onClick={() => setSelected(article)}><span className="tile-image" style={{ backgroundImage: `url("${article.image}")` }} /><span className="tile-copy"><small>{article.category} <i>·</i> {formatDate(article.createdAt)}</small><b>{article.title}</b><span>{article.excerpt}</span><strong>Read news <ArrowRight size={13} /></strong></span></button>)}</div>
        </div> : <div className="pulse-empty">{error || 'Stories will appear here when your database is connected.'}</div>}
      </section>

      <section className="pulse-news-layout" id="latest">
        <div className="pulse-feed"><div className="pulse-section-heading feed-heading"><div><span className="pulse-kicker">FRESH FROM THE NEWSROOM</span><h2>{query ? `Search results` : category === 'All stories' ? 'Latest news feed' : `${category} news`}</h2></div><button className="pulse-view-all" onClick={() => { setPage(1); setCategory('All stories'); setSearchDraft(''); setQuery(''); }}>View all <ArrowRight size={14} /></button></div>
          <div className="pulse-feed-filters">{categoryOptions.map((item) => <button key={item} className={category === item ? 'feed-filter selected' : 'feed-filter'} onClick={() => { setPage(1); setCategory(item); }}>{item === 'All stories' ? 'All' : item}</button>)}</div>
          {error && !articles.length ? <div className="pulse-error"><b>News feed is offline</b><span>Check the API and database connection, then try again.</span><button onClick={() => refreshRef.current?.()}>Retry <ArrowRight size={13} /></button></div> : loading ? <div className="feed-skeletons">{[0, 1, 2].map((n) => <div className="pulse-skeleton-row" key={n} />)}</div> : (remaining.length ? remaining : articles).length ? (remaining.length ? remaining : articles).map((article) => <FeedStory key={article._id} article={article} onOpen={setSelected} onReact={reactTo} onSignIn={() => { openSignIn('login'); setToast('Sign in to react to a story.'); }} user={user} />) : <div className="pulse-empty">No stories in this section yet. Try another category.</div>}
          {page < pages && <button className="pulse-load-more" onClick={() => setPage((current) => current + 1)}>Load more stories <ArrowDown size={14} /></button>}
        </div>
        <aside className="pulse-sidebar">
          <section className="side-panel"><div className="side-title"><h3>Explore categories</h3><span>+</span></div><div className="side-categories">{categoryOptions.slice(1).map((item, i) => <button key={item} onClick={() => { setPage(1); setCategory(item); document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' }); }}><span className={`side-category-icon color-${i % 6}`}>{item[0]}</span>{item}<ArrowRight size={13} /></button>)}</div></section>
          <section className="side-panel trending-panel"><div className="side-title"><h3>Trending now</h3><span className="trend-spark">↗</span></div>{articles.slice(0, 4).map((article, i) => <button className="trending-story" key={article._id} onClick={() => setSelected(article)}><span className="trend-number">0{i + 1}</span><span><small>{article.category} <i>·</i> {article.readMinutes || 4} min read</small><b>{article.title}</b></span></button>)}</section>
          {articles[1] && <button className="side-pick" onClick={() => setSelected(articles[1])}><span className="side-pick-image" style={{ backgroundImage: `url("${articles[1].image}")` }}><span>EDITOR’S PICK</span></span><span className="side-pick-copy"><small>THE EDITORS’ DESK</small><b>{articles[1].title}</b><span>Read the full story <ArrowRight size={13} /></span></span></button>}
          <section className="side-newsletter"><span className="side-newsletter-icon">N</span><small>THE NOVA BRIEF</small><h3>News worth<br />your time.</h3><p>Our editors’ essential reads, in your inbox every morning.</p><form onSubmit={subscribe}><input type="email" name="email" placeholder="Email address" required /><button aria-label="Subscribe" disabled={newsletterBusy}><ArrowRight size={16} /></button></form></section>
        </aside>
      </section>
    </main>
    <footer className="pulse-footer"><a className="pulse-brand" href="#top"><span className="pulse-logo">N</span><span>NOVA<span>PRESS</span></span></a><span>Independent news. A wider point of view.</span><div><a href="#latest">About</a><a href="#latest">Contact</a><a href="#latest">Privacy</a><small>© 2026 Nova Press</small></div></footer>
    {selected && <ArticleModal article={selected} user={user} token={token} socket={liveSocket} onClose={() => setSelected(null)} onReact={reactTo} onComment={comment} onSignIn={() => { setSelected(null); openSignIn('login'); }} />}
    {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onSubmit={authenticate} />}
    {profileOpen && <ProfileModal user={user} token={token} onClose={() => setProfileOpen(false)} onSaved={(nextUser) => { setUser(nextUser); localStorage.setItem('nova-user', JSON.stringify(nextUser)); setToast('Your profile is updated.'); }} onSignOut={() => { setProfileOpen(false); signOut(); }} />}
    {editorOpen && <EditorComposer key={editorOpen?._id || 'new'} article={typeof editorOpen === 'object' ? editorOpen : null} token={token} categoryOptions={categoryOptions.filter((c) => c !== 'All stories')} onClose={() => setEditorOpen(false)} onPublished={() => { setEditorOpen(false); setCategory('All stories'); setQuery(''); refreshRef.current?.(); setToast('Your story is saved.'); }} />}
    {deskOpen && <EditorDesk token={token} role={user?.role} onClose={() => setDeskOpen(false)} onEdit={(article) => { setDeskOpen(false); setEditorOpen(article); }} onChanged={() => { refreshRef.current?.(); fetch('/api/categories').then((r) => r.json()).then((data) => setCategoryOptions(['All stories', ...(data.categories || []).map((c) => c.name)])); }} />}
    {notificationsOpen && <NotificationPanel items={notifications} token={token} onClose={() => setNotificationsOpen(false)} onRead={async (item) => { if (!item.readAt) { await fetch(`/api/notifications/${item._id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }); setNotifications((list) => list.map((n) => n._id === item._id ? { ...n, readAt: new Date() } : n)); setUnreadCount((count) => Math.max(count - 1, 0)); } if (item.article?._id) { const response = await fetch(`/api/articles/${item.article._id}`); const data = await response.json(); if (data.article) setSelected(data.article); } setNotificationsOpen(false); }} onReadAll={async () => { await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }); setNotifications((list) => list.map((n) => ({ ...n, readAt: new Date() }))); setUnreadCount(0); }} />}
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
  </div>;
}

function ArticleCard({ article, onOpen }) {
  return <article className="article-card"><button className="card-image image-button" onClick={() => onOpen(article)} style={{ backgroundImage: `url(${article.image})` }} aria-label={`Read ${article.title}`}><span>{article.category}</span></button><div className="card-content"><div className="card-meta"><span>{formatDate(article.createdAt)}</span><span className="meta-dot">·</span><span><Clock3 size={12} /> {article.readMinutes || 4} min</span></div><button className="card-title" onClick={() => onOpen(article)}>{article.title}</button><p>{article.excerpt}</p><div className="card-bottom"><div className="mini-author"><span className="mini-avatar">{article.author?.name?.[0] || 'N'}</span> {article.author?.name || 'Nova Press'}</div><div className="card-stats"><span><Heart size={14} /> {article.reactions?.filter((r) => r.value === 'like').length || 0}</span><span><MessageCircle size={14} /> {article.comments?.length || 0}</span></div><button className="bookmark-button" onClick={() => onOpen(article)} aria-label="Open story"><ArrowRight size={16} /></button></div></div></article>;
}

function FeedStoryLegacy({ article, onOpen }) {
  return <article className="feed-story"><button className="feed-story-image" onClick={() => onOpen(article)} style={{ backgroundImage: `url("${article.image}")` }} aria-label={`Read ${article.title}`} /><div className="feed-story-copy"><div className="feed-story-meta"><span>{article.category}</span><i>·</i><span>{formatDate(article.publishedAt || article.createdAt)}</span><i>·</i><span>{article.readMinutes || 4} min read</span></div><button className="feed-story-title" onClick={() => onOpen(article)}>{article.title}</button><p>{article.excerpt}</p><div className="feed-story-bottom"><span>{article.source ? <>Source <b>{article.source}</b></> : <>By <b>{article.author?.name || 'Nova Press'}</b></>}</span><span><Heart size={14} /> {article.reactions?.filter((r) => r.value === 'like').length || 0}</span><span><MessageCircle size={14} /> {article.comments?.length || 0}</span><button onClick={() => onOpen(article)}>Read news <ArrowRight size={14} /></button></div></div></article>;
}

function FeedStory({ article, onOpen, onReact, onSignIn, user }) {
  const likes = article.likesCount ?? article.reactions?.filter((reaction) => reaction.value === 'like').length ?? 0;
  const mine = article.myReaction ?? article.reactions?.find((reaction) => String(reaction.user?._id || reaction.user) === String(user?.id))?.value;
  return <article className="feed-story">
    <button className="feed-story-image" onClick={() => onOpen(article)} style={{ backgroundImage: `url("${article.image}")` }} aria-label={`Read ${article.title}`} />
    <div className="feed-story-copy">
      <div className="feed-story-meta"><span>{article.category}</span><i>·</i><span>{formatDate(article.publishedAt || article.createdAt)}</span><i>·</i><span>{article.readMinutes || 4} min read</span></div>
      <button className="feed-story-title" onClick={() => onOpen(article)}>{article.title}</button>
      <p>{article.excerpt}</p>
      <div className="feed-story-bottom">
        <span>{article.source ? <>Source <b>{article.source}</b></> : <>By <b>{article.author?.name || 'Nova Press'}</b></>}</span>
        <button className={mine === 'like' ? 'feed-like chosen' : 'feed-like'} aria-label={mine === 'like' ? 'Remove like' : 'Like story'} title={user ? 'Like story' : 'Sign in to like'} onClick={() => user ? onReact(article._id, 'like') : onSignIn()}><Heart size={14} fill={mine === 'like' ? 'currentColor' : 'none'} /> {likes}</button>
        <span><MessageCircle size={14} /> {article.comments?.length || 0}</span>
        <button className="feed-read-link" onClick={() => onOpen(article)}>Read story <ArrowRight size={14} /></button>
      </div>
    </div>
  </article>;
}

function ArticleModal({ article, user, token, socket, onClose, onReact, onComment, onSignIn }) {
  const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [shareLabel, setShareLabel] = useState('Share');
  const mine = article.myReaction ?? article.reactions?.find((r) => String(r.user?._id || r.user) === String(user?.id))?.value;
  const likes = article.likesCount ?? article.reactions?.filter((r) => r.value === 'like').length ?? 0;
  const dislikes = article.dislikesCount ?? article.reactions?.filter((r) => r.value === 'dislike').length ?? 0;
  useEffect(() => {
    if (!socket || !article._id) return;
    socket.emit('join:article', article._id);
    return () => socket.emit('leave:article', article._id);
  }, [socket, article._id]);
  async function submit(event) { event.preventDefault(); if (!token) return onSignIn(); setBusy(true); try { await onComment(article._id, body); setBody(''); } catch (e) { alert(e.message); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><article className="story-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close story"><X /></button><div className="modal-hero" style={{ backgroundImage: `url(${article.image})` }} /><div className="modal-body">
    <button className="back-link" onClick={onClose}><ArrowLeft size={15} /> BACK TO THE EDITION</button><span className="category-label modal-category">{article.category} <span> / </span> {formatDate(article.publishedAt || article.createdAt)}</span><h1>{article.title}</h1><p className="modal-deck">{article.excerpt}</p>{article.sourceUrl && <a className="article-source-link" href={article.sourceUrl} target="_blank" rel="noreferrer">Originally reported by {article.source || 'source'} <ArrowRight size={13} /></a>}
    <div className="modal-byline"><span className="avatar">{article.author?.name?.[0] || 'N'}</span><span>By <b>{article.author?.name || 'Nova Press'}</b><small>{article.readMinutes || 4} min read</small></span><button className="share-button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setShareLabel('Copied'); setTimeout(() => setShareLabel('Share'), 1500); } catch { setShareLabel('Copy unavailable'); } }}><Share2 size={15} /> {shareLabel}</button></div>
    {article.summary && <div className="article-summary"><b>IN BRIEF</b><p>{article.summary}</p></div>}
    <div className="article-prose">{article.body?.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
    <div className="reaction-bar"><span>Was this story useful?</span><button className={mine === 'like' ? 'react-button chosen' : 'react-button'} onClick={() => onReact(article._id, 'like')}><ThumbsUp size={16} /> Helpful <b>{likes}</b></button><button className={mine === 'dislike' ? 'react-button chosen' : 'react-button'} onClick={() => onReact(article._id, 'dislike')}><ThumbsDown size={16} /> Not for me <b>{dislikes}</b></button></div>
    <section className="comments"><h3>Join the conversation <span>{article.comments?.length || 0}</span></h3><form onSubmit={submit} className="comment-form"><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={token ? 'Share a thoughtful comment…' : 'Sign in to join the conversation'} maxLength={1000} /><button disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Post comment'} <ArrowRight size={15} /></button></form><div className="comment-list">{article.comments?.map((comment) => <div className="comment" key={comment._id || comment.createdAt}><span className="mini-avatar">{comment.author?.name?.[0] || 'N'}</span><div><b>{comment.author?.name || 'Reader'}</b><p>{comment.body}</p></div></div>)}</div></section>
    </div></article></div>;
}

function ProfileModal({ user, token, onClose, onSaved, onSignOut }) {
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function updateProfile(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const response = await fetch('/api/auth/me', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: new FormData(e.currentTarget).get('name') }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); onSaved(data.user); setMessage('Profile details saved.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function updatePassword(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage(''); const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    try { const response = await fetch('/api/auth/me/password', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); e.currentTarget.reset(); setMessage(data.message); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop auth-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="profile-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X /></button><span className="pulse-kicker">READER ACCOUNT</span><h2>Your profile</h2><p>{user.email} <span className="role-chip">{user.role}</span></p><form onSubmit={updateProfile}><label>Display name<input required name="name" maxLength="60" defaultValue={user.name} /></label><button className="auth-submit" disabled={busy}>Save profile <ArrowRight size={15} /></button></form><form onSubmit={updatePassword}><h3>Change password</h3><label>Current password<input required type="password" name="currentPassword" autoComplete="current-password" /></label><label>New password<input required type="password" name="newPassword" minLength="8" autoComplete="new-password" /></label><button className="auth-submit" disabled={busy}>Update password</button></form>{message && <div className="profile-success">{message}</div>}{error && <div className="editor-error">{error}</div>}<button className="signout-button" onClick={onSignOut}>Sign out</button></section></div>;
}

function AuthPage({ mode, setMode, onSubmit, busy, onClose, providers, message }) {
  return <main className="signin-page"><section className="signin-art"><a className="pulse-brand" href="/" onClick={(e) => { e.preventDefault(); onClose(); }}><span className="pulse-logo">N</span><span>NOVA<span>PRESS</span></span></a><div className="signin-editorial"><span className="pulse-kicker">A WIDER POINT OF VIEW</span><h1>Stay curious.<br /><em>Stay informed.</em></h1><p>Thoughtful reporting across the stories shaping our world.</p><div className="signin-art-caption"><i /> Independent journalism, every day.</div></div><div className="signin-art-orbit orbit-one" /><div className="signin-art-orbit orbit-two" /></section><section className="signin-panel"><button className="signin-back" onClick={onClose}><ArrowLeft size={15} /> Back to the edition</button><div className="signin-form-wrap"><span className="pulse-kicker">YOUR NOVA PRESS ACCOUNT</span><h2>{mode === 'login' ? 'Welcome back.' : 'Join the conversation.'}</h2><p>{mode === 'login' ? 'Sign in to save stories and take part in the discussion.' : 'Create a free account to save stories and join the discussion.'}</p>{message && <div className="signin-status" role="status">{message}</div>}{providers.google && <><div className="signin-socials"><a className="social-signin" href="/api/auth/google"><b className="google-g">G</b><span>Continue with Google</span></a></div><div className="signin-divider"><span>or continue with email</span></div></>}<form className="signin-form" onSubmit={onSubmit}>{mode === 'register' && <label>Your name<input required name="name" placeholder="Alex Morgan" autoComplete="name" /></label>}<label>Email address<input required type="email" name="email" placeholder="you@example.com" autoComplete="email" /></label><label>Password<input required type="password" name="password" minLength="8" placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>{mode === 'login' && <div className="signin-forgot">Use the password you created for Nova Press.</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Signing in...' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button></form><div className="auth-switch">{mode === 'login' ? 'New to Nova Press?' : 'Already a reader?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div><div className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy.</div>{!providers.google && <div className="signin-setup-note">Email sign-in is ready. Google sign-in can be enabled in the API configuration.</div>}</div></section></main>;
}

function AuthModal({ mode, setMode, onClose, onSubmit }) {
  return <div className="modal-backdrop auth-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="auth-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X /></button><span className="auth-mark">N</span><div className="section-overline">WELCOME TO NOVA PRESS</div><h2>{mode === 'login' ? 'Good to have you back.' : 'Make room for perspective.'}</h2><p>{mode === 'login' ? 'Sign in to save your place in the conversation.' : 'Create your reader account and join the conversation.'}</p><form onSubmit={onSubmit}>{mode === 'register' && <label>Your name<input required name="name" placeholder="Alex Morgan" autoComplete="name" /></label>}<label>Email address<input required type="email" name="email" placeholder="you@example.com" autoComplete="email" /></label><label>Password<input required type="password" name="password" minLength="8" placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label><button className="auth-submit">{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button></form><div className="auth-switch">{mode === 'login' ? 'New to Nova Press?' : 'Already a reader?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div><div className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy.</div></section></div>;
}

function EditorComposer({ token, article, categoryOptions, onClose, onPublished }) {
  const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false); const [summarizing, setSummarizing] = useState(false); const [error, setError] = useState('');
  const [image, setImage] = useState(article?.image || ''); const [imagePublicId, setImagePublicId] = useState(article?.imagePublicId || ''); const [summary, setSummary] = useState(article?.summary || '');
  async function uploadImage(file) {
    if (!file) return; setUploading(true); setError('');
    const data = new FormData(); data.append('image', file);
    try { const response = await fetch('/api/media/image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setImage(result.image); setImagePublicId(result.publicId); }
    catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }
  async function generateSummary() {
    if (!article?._id) return setError('Save the story first, then generate its AI summary.');
    setSummarizing(true); setError('');
    try { const response = await fetch(`/api/ai/articles/${article._id}/summary`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setSummary(result.summary); }
    catch (e) { setError(e.message); }
    finally { setSummarizing(false); }
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries());
    payload.image = image || payload.image || ''; payload.imagePublicId = imagePublicId; payload.summary = summary;
    payload.readMinutes = Number(payload.readMinutes); payload.featured = form.has('featured'); payload.published = form.has('published');
    try {
      const response = await fetch(article?._id ? `/api/articles/${article._id}` : '/api/articles', { method: article?._id ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Could not save this story.');
      onPublished();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop auth-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="editor-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close editor"><X /></button><div className="section-overline">NOVA PRESS / EDITOR DESK</div><h2>{article ? 'Edit story' : 'Write a story'}</h2><p>Prepare, review, and publish newsroom coverage.</p><form onSubmit={submit}>
    <label>Headline<input required name="title" maxLength="150" placeholder="A clear, thoughtful headline" defaultValue={article?.title || ''} /></label>
    <label>Short introduction<textarea required name="excerpt" maxLength="300" rows="2" placeholder="What should readers know first?" defaultValue={article?.excerpt || ''} /></label>
    <div className="editor-row"><label>Section<select name="category" defaultValue={article?.category || categoryOptions[0] || 'World'}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Reading time<select name="readMinutes" defaultValue={article?.readMinutes || 4}>{[3,4,5,6,7,8,10,12].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label></div>
    <label>Cover image URL<input name="image" type="url" placeholder="https://… (or upload below)" value={image} onChange={(e) => setImage(e.target.value)} /></label>
    <label className="upload-label">Upload image (JPG, PNG, WebP, AVIF; max 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => uploadImage(e.target.files?.[0])} /></label>
    {image && <img className="editor-image-preview" src={image} alt="Selected cover preview" />}
    <label>Full story<textarea required name="body" rows="8" placeholder="Write the full article. Separate paragraphs with a blank line." defaultValue={article?.body || ''} /></label>
    <div className="editor-options"><label className="feature-check"><input type="checkbox" name="featured" defaultChecked={Boolean(article?.featured)} /> Feature this story</label><label className="feature-check"><input type="checkbox" name="published" defaultChecked={article?.published ?? true} /> Publish now</label></div>
    {article?._id && <div className="ai-summary"><div><b>AI assisted summary</b><span>Generated from this story; review before publishing.</span></div><button type="button" onClick={generateSummary} disabled={summarizing}>{summarizing ? 'Summarizing…' : 'Generate summary'}</button>{summary && <p>{summary}</p>}</div>}
    {error && <div className="editor-error">{error}</div>}
    <button className="auth-submit" disabled={saving || uploading}>{saving ? 'Saving…' : uploading ? 'Uploading image…' : article ? 'Save changes' : 'Save story'} <ArrowRight size={16} /></button>
  </form></section></div>;
}

function EditorDesk({ token, role, onClose, onEdit, onChanged }) {
  const [tab, setTab] = useState('stories'); const [stories, setStories] = useState([]); const [cats, setCats] = useState([]); const [users, setUsers] = useState([]); const [subscribers, setSubscribers] = useState([]); const [error, setError] = useState(''); const [categoryName, setCategoryName] = useState(''); const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  async function load() {
    setError('');
    try {
      const [storyRes, catRes] = await Promise.all([fetch('/api/articles/manage', { headers }), fetch('/api/categories/manage', { headers })]);
      const [storyData, catData] = await Promise.all([storyRes.json(), catRes.json()]);
      if (!storyRes.ok) throw new Error(storyData.message); if (!catRes.ok) throw new Error(catData.message);
      setStories(storyData.articles || []); setCats(catData.categories || []);
      if (role === 'admin') { const [r, sr] = await Promise.all([fetch('/api/admin/users', { headers }), fetch('/api/admin/subscribers', { headers })]); const [d, sd] = await Promise.all([r.json(), sr.json()]); if (!r.ok) throw new Error(d.message); if (!sr.ok) throw new Error(sd.message); setUsers(d.users || []); setSubscribers(sd.subscribers || []); }
    } catch (e) { setError(e.message || 'Could not load editor desk.'); }
  }
  useEffect(() => { load(); }, []);
  async function addCategory(e) { e.preventDefault(); setBusy(true); setError(''); try { const r = await fetch('/api/categories', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: categoryName }) }); const d = await r.json(); if (!r.ok) throw new Error(d.message); setCategoryName(''); await load(); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function categoryAction(cat, action) { setBusy(true); setError(''); try { const r = await fetch(`/api/categories/${cat._id}`, action === 'delete' ? { method: 'DELETE', headers } : { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !cat.active }) }); const d = await r.json(); if (!r.ok) throw new Error(d.message); await load(); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function removeArticle(article) { if (!window.confirm(`Delete “${article.title}”?`)) return; setBusy(true); try { const r = await fetch(`/api/articles/${article._id}`, { method: 'DELETE', headers }); const d = await r.json(); if (!r.ok) throw new Error(d.message); await load(); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function syncNews() { setBusy(true); setError(''); try { const r = await fetch('/api/articles/sync/news', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ target: 300 }) }); const d = await r.json(); if (!r.ok) throw new Error(d.message); setError(d.message); await load(); onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function updateRole(userId, roleValue) { try { const r = await fetch(`/api/admin/users/${userId}/role`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: roleValue }) }); const d = await r.json(); if (!r.ok) throw new Error(d.message); await load(); } catch (e) { setError(e.message); } }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="desk-modal"><header><div><span className="pulse-kicker">NOVA PRESS / MANAGEMENT</span><h2>Editor desk</h2></div><button className="icon-button" onClick={onClose} aria-label="Close editor desk"><X /></button></header><nav className="desk-tabs"><button className={tab === 'stories' ? 'active' : ''} onClick={() => setTab('stories')}>Stories</button><button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categories</button>{role === 'admin' && <><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button><button className={tab === 'subscribers' ? 'active' : ''} onClick={() => setTab('subscribers')}>Newsletter</button></>}</nav>{tab === 'stories' && <div className="news-sync-tools"><div><b>Latest from across the world</b><span>Sync reporting into all nine requested sections.</span></div><button disabled={busy} onClick={syncNews}>{busy ? 'Syncing…' : 'Sync 300 latest stories'} <ArrowRight size={14} /></button></div>}{error && <div className="editor-error">{error}</div>}
    {tab === 'stories' && <div className="desk-list">{stories.map((story) => <article key={story._id} className="desk-story"><div className="desk-story-image" style={{ backgroundImage: `url("${story.image}")` }} /><div className="desk-story-info"><small>{story.category} · {story.published ? 'Published' : 'Draft'}</small><b>{story.title}</b><span>Updated {formatDate(story.updatedAt)}</span></div><button onClick={() => onEdit(story)}>Edit</button><button className="delete-button" disabled={busy} onClick={() => removeArticle(story)}>Delete</button></article>)}{!stories.length && <div className="pulse-empty">No stories yet. Create the first one with “Write”.</div>}</div>}
    {tab === 'categories' && <><form className="category-create" onSubmit={addCategory}><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required maxLength="40" placeholder="New section name" /><button disabled={busy}>Add section <ArrowRight size={14} /></button></form><div className="desk-list">{cats.map((cat) => <div className="desk-category" key={cat._id}><span className="side-category-icon">{cat.name[0]}</span><b>{cat.name}</b><small>{cat.active ? 'Active' : 'Hidden'}</small><button onClick={() => categoryAction(cat, 'toggle')} disabled={busy}>{cat.active ? 'Hide' : 'Show'}</button><button className="delete-button" onClick={() => categoryAction(cat, 'delete')} disabled={busy}>Delete</button></div>)}</div></>}
    {tab === 'users' && role === 'admin' && <div className="desk-list">{users.map((person) => <div className="desk-user" key={person._id}><span className="pulse-avatar">{person.name[0]}</span><div><b>{person.name}</b><small>{person.email}</small></div><select value={person.role} onChange={(e) => updateRole(person._id, e.target.value)}><option>reader</option><option>editor</option><option>admin</option></select></div>)}</div>}
    {tab === 'subscribers' && role === 'admin' && <div className="desk-list">{subscribers.map((person) => <div className="desk-user" key={person._id}><span className="side-newsletter-icon">N</span><div><b>{person.email}</b><small>Subscribed {formatDate(person.createdAt)}</small></div><span className="subscriber-active">Active</span></div>)}{!subscribers.length && <div className="pulse-empty">No newsletter subscribers yet.</div>}</div>}
  </section></div>;
}

function NotificationPanel({ items, onClose, onRead, onReadAll }) {
  return <div className="modal-backdrop notification-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="notification-panel"><header><div><span className="pulse-kicker">YOUR NEWSROOM</span><h2>Notifications</h2></div><button className="icon-button" onClick={onClose} aria-label="Close notifications"><X /></button></header><button className="mark-read" onClick={onReadAll}>Mark all as read</button><div className="notification-list">{items.map((item) => <button key={item._id} className={item.readAt ? 'notification-item' : 'notification-item unread'} onClick={() => onRead(item)}><span className="notification-dot" /><span><b>{item.actor?.name || 'Nova Press'}</b><small>{item.message}</small><time>{new Date(item.createdAt).toLocaleString()}</time></span></button>)}{!items.length && <div className="pulse-empty">You’re all caught up.</div>}</div></section></div>;
}
