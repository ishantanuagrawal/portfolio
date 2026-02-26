import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Instagram, 
  Youtube, 
  Linkedin, 
  Twitter, 
  MessageCircle, 
  ChevronRight, 
  Menu, 
  X, 
  Globe,
  Smartphone
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('photography');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [videoFilter, setVideoFilter] = useState('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lightboxContent, setLightboxContent] = useState(null); // { type: 'image'|'iframe', src?, html? }
  const [joinUsModal, setJoinUsModal] = useState(false); // show choice modal
  const [joinUsType, setJoinUsType] = useState(null); // 'client' | 'team'
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    serviceType: '',
    projectDescription: '',
    budget: '',
    timeline: ''
  });
  const [teamForm, setTeamForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    experience: '',
    portfolioLink: '',
    location: '',
    availability: '',
    intro: '',
    resume: null
  });
  const SHEET_WEBHOOK_URL = import.meta.env.VITE_JOIN_US_SHEET_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxO1sn9Y1vKySMpYdCZWOewuSEGMqdD6XfUVAW5H314IF9xtTl8OOqYfGtHoyw5JrJSZw/exec';
  const CLIENT_FORM_ENDPOINT = import.meta.env.VITE_CLIENT_FORM_ENDPOINT || 'https://formsubmit.co/ajax/hello@sbsmedia.co.in';
  const TEAM_FORM_ENDPOINT = import.meta.env.VITE_TEAM_FORM_ENDPOINT || 'https://formsubmit.co/ajax/hello@sbsmedia.co.in';

  // --- AUTOMATED ASSET LOADER ---
  const REPO = useMemo(() => {
    let photoModules = {};
    let videoModules = {};
    let videoTxtModules = {};
    let reelModules = {};
    let reelTxtModules = {};
    let introModules = {};

    try {
      // Photography: Standard images in subdirectories
      photoModules = import.meta.glob('/public/assets/photography/*/*.{avif,png,jpg,jpeg,webp,JPG,PNG}', { eager: true });
      
      // Videography: Thumbnails/Images in subdirectories
      videoModules = import.meta.glob('/public/assets/videography/*/*.{avif,png,jpg,jpeg,webp,mp4,webm}', { eager: true });
      
      // Videography Links: .txt files containing the redirect URLs (per-file)
      videoTxtModules = import.meta.glob('/public/assets/videography/*/*.txt', { query: '?raw', import: 'default', eager: true });
      
      // Reels: Flat directory assets
      reelModules = import.meta.glob('/public/assets/reels/*.{avif,png,jpg,jpeg,webp,mp4}', { eager: true });

      // Reels Links: .txt files for reels
      reelTxtModules = import.meta.glob('/public/assets/reels/*.txt', { query: '?raw', import: 'default', eager: true });

      // Intro/About Image: Single file directory
      introModules = import.meta.glob('/public/assets/intro/*.{avif,png,jpg,jpeg,webp,JPG,PNG}', { eager: true });
    } catch (e) {
      // Fallback for non-Vite environments
    }

    const processSubdirs = (modules, isVideo = false) => {
      const folders = {};
      Object.keys(modules).forEach((path) => {
        const parts = path.split('/');
        const subdir = parts[4]; 
        if (!subdir) return;

        const fullFilename = parts[parts.length - 1];
        const filenameWithoutExt = fullFilename.split('.').slice(0, -1).join('.');
        
        // FIX: Prepend Vite's BASE_URL so it works on GitHub Pages subdirectories
        const browserUrl = import.meta.env.BASE_URL + path.replace(/^\/public\//, ''); 

        // compute small thumbnail url assuming identical structure under top-level small_assets
        // fall back to assets/small_assets if the top-level folder isn't served
        let smallUrl = browserUrl.replace('/assets/photography/', '/small_assets/photography/');
        if (!smallUrl.startsWith(import.meta.env.BASE_URL)) {
          // if replacement didn't work, revert to nested path
          smallUrl = browserUrl.replace('/assets/photography/', '/assets/small_assets/photography/');
        }

        // Look for matching .txt file to extract redirect/iframe link (per-file)
        let externalLink = null;
        if (isVideo) {
          const txtPath = path.substring(0, path.lastIndexOf('.')) + '.txt';
          if (videoTxtModules[txtPath]) {
            externalLink = videoTxtModules[txtPath].trim();
          }
        }

        if (!folders[subdir]) folders[subdir] = [];
        folders[subdir].push({
          id: path,
          title: filenameWithoutExt.replace(/[-_]/g, ' '),
          url: browserUrl,
          smallUrl: smallUrl, // added for thumbnail
          externalLink: externalLink
        });
      });
      return folders;
    };

    const photography = processSubdirs(photoModules, false);
    const videography = processSubdirs(videoModules, true);
    
    // Process Reels
    const reels = Object.keys(reelModules).map(path => {
      const filenameWithoutExt = path.split('/').pop().split('.').slice(0, -1).join('.');
      const txtPath = path.substring(0, path.lastIndexOf('.')) + '.txt';
      let externalLink = null;
      if (reelTxtModules[txtPath]) {
        externalLink = reelTxtModules[txtPath].trim();
      }
      
      return {
        id: path,
        // FIX: Prepend Vite's BASE_URL 
        url: import.meta.env.BASE_URL + path.replace(/^\/public\//, ''),
        title: filenameWithoutExt.replace(/[-_]/g, ' '),
        externalLink: externalLink
      };
    });

    // Pick the intro image (first file in public/assets/intro/)
    const introImgPath = Object.keys(introModules)[0];
    
    // FIX: Prepend Vite's BASE_URL to the intro image
    const introImage = introImgPath 
      ? import.meta.env.BASE_URL + introImgPath.replace(/^\/public\//, '') 
      : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800';

    return { photography, videography, reels, intro: introImage };
  }, []);

  // --- FILTERING LOGIC ---
  const displayedPhotos = useMemo(() => {
    const folders = REPO.photography;
    if (photoFilter === 'all') {
      return Object.keys(folders).map(name => {
        const item = folders[name][0];
        return item ? { ...item, dir: name } : null;
      }).filter(Boolean);
    }
    return (folders[photoFilter] || []).map(item => ({ ...item, dir: photoFilter }));
  }, [photoFilter, REPO]);

  const displayedVideos = useMemo(() => {
    const folders = REPO.videography;
    if (videoFilter === 'all') {
      return Object.keys(folders).map(name => {
        const item = folders[name][0];
        return item ? { ...item, dir: name } : null;
      }).filter(Boolean);
    }
    return (folders[videoFilter] || []).map(item => ({ ...item, dir: videoFilter }));
  }, [videoFilter, REPO]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollWithOffset = (elId) => {
    const element = document.getElementById(elId);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const formatLabel = (str) => str ? str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

  const makeIframeHtml = (src) => {
    if (!src) return null;
    let url = src.trim();
    if (url.includes('watch?v=')) url = url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) url = url.replace('youtu.be/', 'www.youtube.com/embed/');
    // if it's already an iframe HTML, return as-is
    if (url.startsWith('<iframe')) return url;
    return `<iframe src="${url}" width="960" height="540" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  };

  const handleVideoClick = (video) => {
    // If there's a mapping (json or txt) open it immediately as iframe (or external)
    if (video.externalLink) {
      const ext = video.externalLink;
      if (ext.trim().startsWith('<iframe') || ext.includes('youtube') || ext.includes('youtu.be')) {
        const html = ext.trim().startsWith('<iframe') ? ext : makeIframeHtml(ext);
        setLightboxContent({ type: 'iframe', html });
      } else {
        window.open(ext, '_blank');
      }
      return;
    }

    // No mapping: if in 'all' view, drill down to category; otherwise show local preview
    if (videoFilter === 'all') {
      setVideoFilter(video.dir);
    } else {
      setLightboxContent({ type: 'image', src: video.url });
    }
  };

  const closeJoinUsAndReset = () => {
    setJoinUsType(null);
    setJoinUsModal(false);
    setSuccessMessage(null);
    setErrorMessage(null);
    setClientForm({ name: '', company: '', email: '', phone: '', serviceType: '', projectDescription: '', budget: '', timeline: '' });
    setTeamForm({ name: '', email: '', phone: '', role: '', experience: '', portfolioLink: '', location: '', availability: '', intro: '', resume: null });
  };

  const submitFormData = async (endpoint, payload) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: payload
    });
    const responseData = await response.json().catch(() => ({}));
    if (!response.ok || responseData?.success === 'false') {
      throw new Error(responseData?.message || 'Submission failed. Please try again.');
    }
    return responseData;
  };

  const submitToSheetWebhook = async (payload) => {
    // Using text/plain avoids CORS preflight headaches for simple Apps Script webhooks.
    await fetch(SHEET_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!clientForm.name || !clientForm.email || !clientForm.serviceType || !clientForm.budget) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      setSubmitting(true);
      const clientPayload = {
        form_type: 'Client Inquiry',
        submitted_at: new Date().toISOString(),
        name: clientForm.name,
        company: clientForm.company,
        email: clientForm.email,
        phone: clientForm.phone,
        service_type: clientForm.serviceType,
        project_description: clientForm.projectDescription,
        budget: clientForm.budget,
        timeline: clientForm.timeline
      };

      if (SHEET_WEBHOOK_URL) {
        await submitToSheetWebhook(clientPayload);
      } else {
        const payload = new FormData();
        payload.append('form_type', 'Client Inquiry');
        payload.append('_subject', `New Client Inquiry: ${clientForm.name}`);
        payload.append('name', clientForm.name);
        payload.append('company', clientForm.company);
        payload.append('email', clientForm.email);
        payload.append('phone', clientForm.phone);
        payload.append('service_type', clientForm.serviceType);
        payload.append('project_description', clientForm.projectDescription);
        payload.append('budget', clientForm.budget);
        payload.append('timeline', clientForm.timeline);
        await submitFormData(CLIENT_FORM_ENDPOINT, payload);
      }
      setSuccessMessage('Thank you! Our team will contact you shortly.');
      setTimeout(() => closeJoinUsAndReset(), 2000);
    } catch (error) {
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!teamForm.name || !teamForm.email || !teamForm.role || !teamForm.experience) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      setSubmitting(true);
      const teamPayload = {
        form_type: 'Team Application',
        submitted_at: new Date().toISOString(),
        name: teamForm.name,
        email: teamForm.email,
        phone: teamForm.phone,
        role: teamForm.role,
        experience: teamForm.experience,
        availability: teamForm.availability,
        portfolio_link: teamForm.portfolioLink,
        location: teamForm.location,
        intro: teamForm.intro,
        resume_file_name: teamForm.resume?.name || ''
      };

      if (SHEET_WEBHOOK_URL) {
        await submitToSheetWebhook(teamPayload);
      } else {
        const payload = new FormData();
        payload.append('form_type', 'Team Application');
        payload.append('_subject', `New Team Application: ${teamForm.name}`);
        payload.append('name', teamForm.name);
        payload.append('email', teamForm.email);
        payload.append('phone', teamForm.phone);
        payload.append('role', teamForm.role);
        payload.append('experience', teamForm.experience);
        payload.append('availability', teamForm.availability);
        payload.append('portfolio_link', teamForm.portfolioLink);
        payload.append('location', teamForm.location);
        payload.append('intro', teamForm.intro);
        if (teamForm.resume) payload.append('resume', teamForm.resume);
        await submitFormData(TEAM_FORM_ENDPOINT, payload);
      }
      setSuccessMessage("Thanks! We'll review your profile and contact you if there's a match.");
      setTimeout(() => closeJoinUsAndReset(), 2000);
    } catch (error) {
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-200 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&family=Playfair+Display:ital,wght@1,400;1,700&display=swap');
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll { display: flex; width: max-content; animation: scroll 40s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .fluid-h1 { font-size: clamp(2.5rem, 8vw, 6rem); line-height: 1.1; }
        .fluid-h2 { font-size: clamp(2rem, 5vw, 4rem); line-height: 1.2; }
        .font-serif { font-family: 'Playfair Display', serif; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md py-4 border-b border-zinc-100 shadow-sm' : 'bg-transparent py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <img
            src={import.meta.env.BASE_URL + 'assets/sbslogo/Black%20png%20logo%20for%20watermark%20SBS.png'}
            alt="SBS Media Logo"
            className="site-logo cursor-pointer transition-opacity hover:opacity-80"
            onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
          />
          <div className="hidden md:flex space-x-10 text-[11px] font-bold tracking-widest uppercase text-zinc-400">
            <button onClick={() => {setActiveTab('photography'); scrollWithOffset('portfolio')}} className="hover:text-zinc-900 transition-colors">Portfolio</button>
            <button onClick={() => scrollWithOffset('about')} className="hover:text-zinc-900 transition-colors">About</button>
            <button onClick={() => scrollWithOffset('clients')} className="hover:text-zinc-900 transition-colors">Clients</button>
            <button onClick={() => scrollWithOffset('contact')} className="hover:text-zinc-900 transition-colors">Contact</button>
          </div>
          <button className="md:hidden z-50 p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`fixed inset-0 z-40 bg-white flex flex-col items-center justify-center space-y-8 text-xl uppercase tracking-widest font-light md:hidden transition-transform duration-500 ${isMenuOpen ? 'translate-y-0' : '-translate-y-full'}`}>
        <button onClick={() => { setActiveTab('photography'); setIsMenuOpen(false); scrollWithOffset('portfolio'); }}>Photography</button>
        <button onClick={() => { setActiveTab('videography'); setIsMenuOpen(false); scrollWithOffset('portfolio'); }}>Videography</button>
        <button onClick={() => { setActiveTab('reels'); setIsMenuOpen(false); scrollWithOffset('portfolio'); }}>Reels</button>
        <button onClick={() => { setIsMenuOpen(false); scrollWithOffset('contact'); }}>Contact</button>
      </div>

      {/* Hero */}
      <section className="pt-32 pb-12 md:pt-44 md:pb-20 px-6 max-w-7xl mx-auto">
        <h1 className="fluid-h1 font-light tracking-tight mb-6 leading-[1.1]">Documenting life <br /><span className="font-serif italic text-zinc-400">as it unfolds.</span></h1>
        <p className="text-base md:text-xl text-zinc-500 max-w-2xl leading-relaxed">High-quality visual storytelling for architecture, interiors, and live events. Based in India, serving globally.</p>
      </section>

      {/* Portfolio Grid */}
      <main id="portfolio" className="max-w-7xl mx-auto px-6 pb-24 border-t border-zinc-100 pt-10">
        <div className="flex space-x-10 mb-10 border-b border-zinc-100 overflow-x-auto no-scrollbar">
          {['photography', 'videography', 'reels'].map((tab) => (
            <button key={tab} onClick={() => {setActiveTab(tab); setPhotoFilter('all'); setVideoFilter('all')}} className={`pb-4 text-[11px] uppercase tracking-widest transition-all relative font-bold ${activeTab === tab ? 'text-zinc-900' : 'text-zinc-400'}`}>
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-900" />}
            </button>
          ))}
        </div>

        {/* Photography Sections */}
        {activeTab === 'photography' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-10">
              <button onClick={() => setPhotoFilter('all')} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${photoFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200'}`}>Show All Categories</button>
              {Object.keys(REPO.photography).map((dir) => (
                <button key={dir} onClick={() => setPhotoFilter(dir)} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${photoFilter === dir ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200'}`}>
                  {formatLabel(dir)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedPhotos.map((photo) => (
                <div key={photo.id} className="group relative overflow-hidden bg-zinc-50 aspect-[4/5] rounded-sm cursor-pointer shadow-sm" onClick={() => {
                      if (photoFilter === 'all') {
                        setPhotoFilter(photo.dir);
                      } else {
                        setLightboxContent({ type: 'image', src: photo.url });
                      }
                    }}>
                  <img src={photo.smallUrl ?? photo.url} alt={photo.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-8 flex flex-col justify-end text-white">
                    <p className="text-[9px] uppercase tracking-widest mb-1 opacity-80">{formatLabel(photo.dir)}</p>
                    <h3 className="text-xl font-light">{photo.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Videography Sections */}
        {activeTab === 'videography' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-10">
              <button onClick={() => setVideoFilter('all')} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${videoFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200'}`}>Show All Categories</button>
              {Object.keys(REPO.videography).map((dir) => (
                <button key={dir} onClick={() => setVideoFilter(dir)} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${videoFilter === dir ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200'}`}>
                  {formatLabel(dir)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {displayedVideos.map((video) => (
                <div 
                  key={video.id} 
                  className="group cursor-pointer" 
                  onClick={() => handleVideoClick(video)}
                >
                  <div className="relative aspect-video overflow-hidden rounded-sm mb-4 bg-zinc-100 shadow-sm">
                    <img src={video.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                      <div className="w-14 h-14 rounded-full border border-white/50 backdrop-blur-sm flex items-center justify-center text-white">
                        <ChevronRight size={28} />
                      </div>
                    </div>
                    {videoFilter !== 'all' && video.externalLink && (
                      <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-2 py-1 rounded text-[8px] text-white uppercase tracking-widest border border-white/20">
                        External Link
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-light leading-tight">
                    {videoFilter === 'all' ? formatLabel(video.dir) : video.title}
                  </h3>
                  <p className="text-zinc-400 text-[10px] uppercase tracking-widest mt-1 font-medium">
                    {videoFilter === 'all' ? 'Explore Category' : (video.externalLink ? 'Watch Video' : 'Local Content')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reels Section */}
        {activeTab === 'reels' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {REPO.reels.map((reel) => (
                <div 
                key={reel.id} 
                className="group relative aspect-[9/16] overflow-hidden bg-zinc-100 rounded-sm shadow-sm cursor-pointer"
                onClick={() => {
                  if (reel.externalLink) {
                    window.open(reel.externalLink, '_blank');
                  } else {
                    setLightboxContent({ type: 'image', src: reel.url });
                  }
                }}
              >
                <img src={reel.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                  <Smartphone size={32} className="text-white opacity-40" />
                </div>
                {reel.externalLink && (
                  <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-2 py-1 rounded text-[8px] text-white uppercase tracking-widest border border-white/20">
                    External Link
                  </div>
                )}
                <div className="absolute bottom-6 left-6 text-white drop-shadow-md">
                   <p className="text-[9px] uppercase tracking-widest font-bold">Reel</p>
                   <h3 className="text-lg font-light leading-tight">{reel.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* About Section */}
      <section id="about" className="py-24 px-6 bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 mb-4 font-bold">The Story</p>
            <h2 className="fluid-h2 font-light mb-8 leading-tight text-zinc-900">I'm Shantanu, <br /> <span className="italic font-serif text-zinc-400">Founder of SBS Media.</span></h2>
            <p className="text-zinc-500 leading-relaxed text-base max-w-lg mb-8">Inspired by travel and storytelling, I specialize in architecture and event visuals that resonate. With 4+ years of experience, we strive for high-quality, authentic visuals that tell your brand's unique story.</p>
            <div className="flex space-x-12 border-t border-zinc-200 pt-8">
              <div><div className="text-3xl font-bold text-zinc-900">4+</div><div className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Years Exp</div></div>
              <div><div className="text-3xl font-bold text-zinc-900">100+</div><div className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Projects</div></div>
            </div>
          </div>
          <div className="relative aspect-[4/5] max-w-sm mx-auto">
             <div className="absolute -inset-4 border border-zinc-200 translate-x-4 translate-y-4 shadow-sm" />
             <img
               src={REPO.intro}
               className="w-full h-full object-cover relative z-10 shadow-2xl transition-all duration-700 cursor-pointer"
               alt="Shantanu"
               onClick={() => setLightboxContent({ type: 'image', src: REPO.intro })}
             />
          </div>
        </div>
      </section>

      {/* Partners Infinite Scroll */}
      <section id="clients" className="py-16 overflow-hidden border-b border-zinc-100">
        <div className="px-6 max-w-7xl mx-auto mb-10"><p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 font-bold">Partnerships</p></div>
        <div className="w-full overflow-hidden">
          <div className="animate-scroll whitespace-nowrap py-4">
            {['Westside', 'Urban Vault', 'Smadex', 'Ketto', 'Aditya Birla', 'Ketto', 'EIMR', 'JITO', 'Riverside', 'RCC', 'Europe Girl', 'NewMe', '1st Coffee', 'Conrad', 'Pi Ventures', 'Vippy Soya', 'Under25','Brigade','BizDateUp','Verix','WLDD','Google','Ola','Bloom','Things 2 Do'].concat(['Vogue', 'Tesla', 'Airbnb', 'Nike', 'Red Bull', 'Adobe', 'Sony', 'Canon', 'Apple', 'Zara', 'BMW', 'Rolex', 'Uber', 'Spotify']).map((c, i) => (
              <span key={i} className="mx-12 text-4xl md:text-6xl font-bold tracking-tighter text-zinc-200 hover:text-zinc-900 transition-colors uppercase select-none">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-zinc-100 bg-white text-center">
        <div className="flex justify-center flex-wrap gap-12 mb-10 text-zinc-300">
          <a href="https://instagram.com/storiesbyshantanu/" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Instagram size={24} /></a>
          <a href="https://www.youtube.com/@shantanu.sbsmedia/videos" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Youtube size={24} /></a>
          <a href="https://www.linkedin.com/in/shantanu-agrawal-6b3893191/" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Linkedin size={24} /></a>
          <a href="https://wa.me/9455385894" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><MessageCircle size={24} /></a>
          <a href="mailto:hello@sbsmedia.co.in" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Mail size={24} /></a>
        </div>
        <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-400 font-medium">
          &copy; {new Date().getFullYear()} SBS Media. Quality in every frame.
        </p>
      </footer>

      {/* lightbox overlay (supports images and iframe HTML) */}
      {lightboxContent && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setLightboxContent(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {lightboxContent.type === 'image' && (
              <img
                src={lightboxContent.src}
                className="max-h-[90vh] max-w-[90vw] object-contain animate-fade-in"
                alt="Preview"
              />
            )}
            {lightboxContent.type === 'iframe' && (
              <div className="max-h-[90vh] max-w-[90vw] animate-fade-in" dangerouslySetInnerHTML={{ __html: lightboxContent.html }} />
            )}
            <button
              className="absolute top-0 right-0 text-white text-3xl p-2"
              onClick={() => setLightboxContent(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Join Us Button - Fixed Bottom Right */}
      <button
        onClick={() => setJoinUsModal(true)}
        className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all font-semibold text-[13px] uppercase tracking-widest hover:scale-105"
      >
        Join Us
      </button>

      {/* Join Us Choice Modal */}
      {joinUsModal && !joinUsType && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={closeJoinUsAndReset}
        >
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 animate-fade-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 text-zinc-900">Join SBS Media</h2>
            <p className="text-zinc-500 mb-6">What brings you here?</p>
            <div className="space-y-4">
              <button
                onClick={() => { setErrorMessage(null); setJoinUsType('client'); }}
                className="w-full bg-zinc-900 text-white py-3 rounded-lg font-semibold hover:bg-zinc-800 transition-colors"
              >
                Looking for Videographer / Photography Services
              </button>
              <button
                onClick={() => { setErrorMessage(null); setJoinUsType('team'); }}
                className="w-full border-2 border-zinc-900 text-zinc-900 py-3 rounded-lg font-semibold hover:bg-zinc-50 transition-colors"
              >
                Looking to Join Our Team
              </button>
            </div>
            <button
              onClick={closeJoinUsAndReset}
              className="mt-6 w-full text-zinc-400 text-sm hover:text-zinc-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Client Form Modal */}
      {joinUsModal && joinUsType === 'client' && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto"
          onClick={closeJoinUsAndReset}
        >
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8 animate-fade-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Start Your Project</h2>
              <button onClick={closeJoinUsAndReset} className="text-zinc-400 hover:text-zinc-600 text-2xl">×</button>
            </div>
            <form onSubmit={handleClientSubmit} className="space-y-4">
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                />
                <input
                  type="text"
                  placeholder="Company / Brand Name"
                  value={clientForm.company}
                  onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="email"
                  placeholder="Email *"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={clientForm.serviceType}
                  onChange={(e) => setClientForm({ ...clientForm, serviceType: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                >
                  <option value="">Service Type *</option>
                  <option value="reels">Social Media Reels</option>
                  <option value="brandfilm">Brand Film</option>
                  <option value="adshoot">Ad Shoot</option>
                  <option value="event">Event Coverage</option>
                  <option value="product">Product Shoot</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={clientForm.budget}
                  onChange={(e) => setClientForm({ ...clientForm, budget: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                >
                  <option value="">Budget *</option>
                  <option value="under50k">Under ₹50,000</option>
                  <option value="50-100k">₹50,000 – ₹1L</option>
                  <option value="1-3l">₹1L – ₹3L</option>
                  <option value="3lplus">₹3L+</option>
                </select>
              </div>
              <textarea
                placeholder="Project Description"
                value={clientForm.projectDescription}
                onChange={(e) => setClientForm({ ...clientForm, projectDescription: e.target.value })}
                className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                rows="3"
              />
              <input
                type="date"
                placeholder="Expected Timeline"
                value={clientForm.timeline}
                onChange={(e) => setClientForm({ ...clientForm, timeline: e.target.value })}
                className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-zinc-900 text-white py-3 rounded-lg font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={closeJoinUsAndReset}
                  className="flex-1 border-2 border-zinc-900 text-zinc-900 py-3 rounded-lg font-semibold hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Form Modal */}
      {joinUsModal && joinUsType === 'team' && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto"
          onClick={closeJoinUsAndReset}
        >
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8 animate-fade-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Join Our Team</h2>
              <button onClick={closeJoinUsAndReset} className="text-zinc-400 hover:text-zinc-600 text-2xl">×</button>
            </div>
            <form onSubmit={handleTeamSubmit} className="space-y-4">
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={teamForm.email}
                  onChange={(e) => setTeamForm({ ...teamForm, email: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={teamForm.phone}
                  onChange={(e) => setTeamForm({ ...teamForm, phone: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <select
                  value={teamForm.role}
                  onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                >
                  <option value="">Role Applying For *</option>
                  <option value="editor">Video Editor</option>
                  <option value="videographer">Videographer</option>
                  <option value="photographer">Photographer</option>
                  <option value="motiongraphics">Motion Graphics Artist</option>
                  <option value="content">Content Creator</option>
                  <option value="intern">Intern</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={teamForm.experience}
                  onChange={(e) => setTeamForm({ ...teamForm, experience: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  required
                >
                  <option value="">Experience Level *</option>
                  <option value="fresher">Fresher</option>
                  <option value="1-2">1–2 Years</option>
                  <option value="3-5">3–5 Years</option>
                  <option value="5plus">5+ Years</option>
                </select>
                <select
                  value={teamForm.availability}
                  onChange={(e) => setTeamForm({ ...teamForm, availability: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">Availability</option>
                  <option value="fulltime">Full-time</option>
                  <option value="freelance">Freelance</option>
                  <option value="parttime">Part-time</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="url"
                  placeholder="Portfolio Link (behance, instagram, website)"
                  value={teamForm.portfolioLink}
                  onChange={(e) => setTeamForm({ ...teamForm, portfolioLink: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={teamForm.location}
                  onChange={(e) => setTeamForm({ ...teamForm, location: e.target.value })}
                  className="px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <textarea
                placeholder="Short Introduction"
                value={teamForm.intro}
                onChange={(e) => setTeamForm({ ...teamForm, intro: e.target.value })}
                className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                rows="3"
              />
              <div className="border-2 border-dashed border-zinc-300 rounded-lg p-4 text-center cursor-pointer hover:border-zinc-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setTeamForm({ ...teamForm, resume: e.target.files?.[0] || null })}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  {teamForm.resume ? (
                    <p className="text-sm text-zinc-600"><strong>{teamForm.resume.name}</strong> uploaded</p>
                  ) : (
                    <p className="text-sm text-zinc-500">Resume Upload (optional)<br />Drag and drop or click to browse</p>
                  )}
                </label>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-zinc-900 text-white py-3 rounded-lg font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={closeJoinUsAndReset}
                  className="flex-1 border-2 border-zinc-900 text-zinc-900 py-3 rounded-lg font-semibold hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Message Modal */}
      {successMessage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 animate-fade-in shadow-2xl text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-2">Success!</h3>
            <p className="text-zinc-500">{successMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
