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

  // --- AUTOMATED ASSET LOADER ---
  const REPO = useMemo(() => {
    let photoModules = {};
    let videoModules = {};
    let videoTxtModules = {};
    let reelModules = {};
    let reelTxtModules = {};
    let introModules = {};

    try {
      // Photography: Standard images
      photoModules = import.meta.glob('/public/assets/photography/*/*.{avif,png,jpg,jpeg,webp,JPG,PNG}', { eager: true });
      
      // Videography: Thumbnails/Images
      videoModules = import.meta.glob('/public/assets/videography/*/*.{avif,png,jpg,jpeg,webp,mp4,webm}', { eager: true });
      
      // Videography Links
      videoTxtModules = import.meta.glob('/public/assets/videography/*/*.txt', { query: '?raw', import: 'default', eager: true });
      
      // Reels: Flat directory
      reelModules = import.meta.glob('/public/assets/reels/*.{avif,png,jpg,jpeg,webp,mp4}', { eager: true });

      // Reels Links
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
        const browserUrl = path.replace('/public', ''); 

        // Look for matching .txt file
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
        url: path.replace('/public', ''),
        title: filenameWithoutExt.replace(/[-_]/g, ' '),
        externalLink: externalLink
      };
    });

    // Pick the intro image (first file in public/assets/intro/)
    const introImgPath = Object.keys(introModules)[0];
    const introImage = introImgPath 
      ? introImgPath.replace('/public', '') 
      : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=800';

    // Fallback data for the Canvas environment
    if (Object.keys(photography).length === 0 && Object.keys(videography).length === 0 && reels.length === 0) {
      return {
        photography: {
          interiors: [{ id: 's1', title: 'Sample Interior', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800' }]
        },
        videography: {
          brand_films: [{ 
            id: 's2', 
            title: 'Sample Film (Create a .txt file locally)', 
            url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800',
            externalLink: 'https://www.youtube.com' 
          }]
        },
        reels: [
          { 
            id: 's3', 
            title: 'Sample Reel', 
            url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&q=80&w=800',
            externalLink: 'https://www.instagram.com' 
          }
        ],
        intro: introImage
      };
    }

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

  const handleVideoClick = (video) => {
    if (videoFilter === 'all') {
      setVideoFilter(video.dir);
    } else if (video.externalLink) {
      window.open(video.externalLink, '_blank');
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
      `}</style>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md py-4 border-b border-zinc-100 shadow-sm' : 'bg-transparent py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="text-xl md:text-2xl font-bold tracking-tighter cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            SBS<span className="text-zinc-400">MEDIA</span>
          </div>
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
              <button onClick={() => setPhotoFilter('all')} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${photoFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200 hover:border-zinc-400'}`}>Show All Categories</button>
              {Object.keys(REPO.photography).map((dir) => (
                <button key={dir} onClick={() => setPhotoFilter(dir)} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${photoFilter === dir ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200 hover:border-zinc-400'}`}>
                  {formatLabel(dir)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedPhotos.map((photo) => (
                <div key={photo.id} className="group relative overflow-hidden bg-zinc-50 aspect-[4/5] rounded-sm cursor-pointer shadow-sm" onClick={() => photoFilter === 'all' && setPhotoFilter(photo.dir)}>
                  <img src={photo.url} alt={photo.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-8 flex flex-col justify-end text-white">
                    <p className="text-[9px] uppercase tracking-widest mb-1 opacity-80">{formatLabel(photo.dir)}</p>
                    <h3 className="text-xl font-light">{photoFilter === 'all' ? 'Explore Category' : photo.title}</h3>
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
              <button onClick={() => setVideoFilter('all')} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${videoFilter === 'all' ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200 hover:border-zinc-400'}`}>Show All Categories</button>
              {Object.keys(REPO.videography).map((dir) => (
                <button key={dir} onClick={() => setVideoFilter(dir)} className={`px-4 py-1.5 rounded-full text-[10px] uppercase border transition-all ${videoFilter === dir ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-500 border-zinc-200 hover:border-zinc-400'}`}>
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

        {/* Reels Section
        {activeTab === 'reels' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {REPO.reels.map((reel) => (
              <div 
                key={reel.id} 
                className={`group relative aspect-[9/16] overflow-hidden bg-zinc-100 rounded-sm shadow-sm ${reel.externalLink ? 'cursor-pointer' : ''}`}
                onClick={() => reel.externalLink && window.open(reel.externalLink, '_blank')}
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
        )} */}
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
             <img src={REPO.intro} className="w-full h-full object-cover relative z-10 shadow-2xl transition-all duration-700" alt="Shantanu" />
          </div>
        </div>
      </section>

      {/* Partners Infinite Scroll */}
      <section id="clients" className="py-16 overflow-hidden border-b border-zinc-100">
        <div className="px-6 max-w-7xl mx-auto mb-10"><p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 font-bold">Partnerships</p></div>
        <div className="w-full overflow-hidden">
          <div className="animate-scroll whitespace-nowrap py-4">
            {['Vogue', 'Tesla', 'Airbnb', 'Nike', 'Red Bull', 'Adobe', 'Sony', 'Canon', 'Apple', 'Zara', 'BMW', 'Rolex', 'Uber', 'Spotify'].concat(['Vogue', 'Tesla', 'Airbnb', 'Nike', 'Red Bull', 'Adobe', 'Sony', 'Canon', 'Apple', 'Zara', 'BMW', 'Rolex', 'Uber', 'Spotify']).map((c, i) => (
              <span key={i} className="mx-12 text-4xl md:text-6xl font-bold tracking-tighter text-zinc-200 hover:text-zinc-900 transition-colors uppercase select-none">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-zinc-100 bg-white text-center">
        <div className="flex justify-center flex-wrap gap-12 mb-10 text-zinc-300">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Instagram size={24} /></a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Youtube size={24} /></a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Linkedin size={24} /></a>
          <a href="https://wa.me/yournumber" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-all transform hover:scale-110"><MessageCircle size={24} /></a>
          <a href="mailto:hello@sbsmedia.co.in" className="hover:text-zinc-900 transition-all transform hover:scale-110"><Mail size={24} /></a>
        </div>
        <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-400 font-medium">
          &copy; {new Date().getFullYear()} SBS Media. Quality in every frame.
        </p>
      </footer>
    </div>
  );
};

export default App;