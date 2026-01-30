
import React, { useState, useEffect, useRef } from 'react';
import { CloudManifestItem, GameState, Lead, LeadDetails, Transmission, User } from './types';
import { 
  generateTitleAndSetting, 
  generateExposition, 
  generateLeads, 
  generateTransmissionHeader, 
  generateLeadInspectionText,
  generateLeadInspectionImage,
  generateFullTransmission,
  setGeminiUser
} from './services/gemini';
import { saveTransmission, getAllTransmissions, deleteTransmission, exportTransmission, importTransmission } from './services/db';
import { initGoogleClient, signIn, fetchCloudManifest, fetchCloudTransmission, uploadTransmissionToCloud } from './services/cloud';
import { CATEGORIES } from './constants';

// Simplified Typewriter hook
const useTypewriter = (text: string, speed: number = 10, startTrigger: boolean = true) => {
  const [index, setIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!startTrigger || !text) {
      setIndex(0);
      setIsComplete(false);
      return;
    }
    
    setIndex(0);
    setIsComplete(false);

    let currentIdx = 0;
    const interval = setInterval(() => {
      currentIdx++;
      if (currentIdx >= text.length) {
        setIndex(text.length);
        setIsComplete(true);
        clearInterval(interval);
      } else {
        setIndex(currentIdx);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, startTrigger]);

  return { displayedText: text.slice(0, index), isComplete };
};

const App: React.FC = () => {
  const [state, setState] = useState<GameState>({
    transmission: null,
    status: 'setup'
  });
  const [activeLead, setActiveLead] = useState<{ lead: Lead; details?: LeadDetails } | null>(null);
  const [isImageRevealed, setIsImageRevealed] = useState(false);
  const [themeInput, setThemeInput] = useState('Neo-Tokyo 2099 - Yakuza Cyber-War');
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Data State
  const [localArchives, setLocalArchives] = useState<Transmission[]>([]);
  const [cloudArchives, setCloudArchives] = useState<CloudManifestItem[]>([]);
  const [viewMode, setViewMode] = useState<'local' | 'cloud'>('cloud');

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [hasManualKey, setHasManualKey] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
    loadLocalArchives();
    loadCloudArchives();
    checkManualKey();
    
    initGoogleClient((u) => {
        setUser(u);
        setGeminiUser(u);
    });
  }, []);

  const checkManualKey = () => {
      const k = localStorage.getItem('technoir_api_key');
      if (k && k.length > 10) setHasManualKey(true);
  };

  const loadLocalArchives = async () => {
      try { setLocalArchives(await getAllTransmissions()); } catch (e) { console.error(e); }
  };

  const loadCloudArchives = async () => {
      try { setCloudArchives(await fetchCloudManifest()); } catch (e) { console.error(e); }
  };

  const handleManualKeySubmit = (key: string) => {
      localStorage.setItem('technoir_api_key', key);
      setHasManualKey(true);
      setShowKeyModal(false);
  };

  const handleDisconnectKey = () => {
      localStorage.removeItem('technoir_api_key');
      setHasManualKey(false);
  };

  // --- Generation Handlers ---

  const canGenerate = user || hasManualKey;

  const handleGenerate = async () => {
    if (!canGenerate) {
        setShowKeyModal(true);
        return;
    }

    setState(prev => ({ ...prev, status: 'loading' }));
    setLoadingMessage('INITIALIZING NEURAL UPLINK...');
    
    try {
      if (isBulkGenerating) {
          // BACKGROUND BULK MODE
          setLoadingMessage('>> INITIATING FULL-SPECTRUM GENERATION PROTOCOL...\n>> THIS PROCESS MAY TAKE SEVERAL MINUTES.');
          const t = await generateFullTransmission(themeInput, (msg) => setLoadingMessage(msg));
          
          await saveTransmission(t);
          await loadLocalArchives();
          setState({ transmission: t, status: 'viewing' });

      } else {
          // INTERACTIVE MODE (Standard)
          setLoadingMessage('>> ESTABLISHING SECURE CONNECTION...');
          const titleData = await generateTitleAndSetting(themeInput, (text) => setLoadingMessage(`>> GENERATING IDENTITY PROTOCOLS...\n\n${text}`));
          
          const exposition = await generateExposition(themeInput, titleData.title, titleData.settingSummary, (text) => setLoadingMessage(`>> DOWNLOADING SECTOR EXPOSITION...\n\n${text}`));
          
          const headerPromise = generateTransmissionHeader(titleData.title, titleData.settingSummary, exposition);
          
          const leads = await generateLeads(themeInput, titleData.title, titleData.settingSummary, exposition, (text) => setLoadingMessage(`>> COMPILING NETWORK NODES...\n\n${text}`));
          
          const transmission: Transmission = {
            id: Date.now(),
            createdAt: new Date().toLocaleDateString('en-US'),
            title: titleData.title,
            settingSummary: titleData.settingSummary,
            exposition,
            leads,
            headerImageUrl: undefined 
          };

          setState({ transmission, status: 'viewing' });
          setLoadingMessage('');

          // Header async update
          const headerUrl = await headerPromise;
          if (headerUrl) {
            const updated = { ...transmission, headerImageUrl: headerUrl };
            await saveTransmission(updated);
            setState(prev => (prev.transmission?.id === transmission.id ? { ...prev, transmission: updated } : prev));
          } else {
            await saveTransmission(transmission);
          }
          await loadLocalArchives();
      }
    } catch (error: any) {
      console.error(error);
      setState(prev => ({ ...prev, status: 'setup', error: "Transmission Interrupted. Check Protocol." }));
    }
  };

  const handleCloudUpload = async (t: Transmission, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user?.isMaster || !user.accessToken) return;
      
      const confirm = window.confirm(`UPLOAD WARNING: This will publish "${t.title}" to the public network.`);
      if (!confirm) return;

      try {
          await uploadTransmissionToCloud(t, user.accessToken);
          alert("UPLOAD COMPLETE.");
          loadCloudArchives();
      } catch (err) {
          alert("UPLOAD FAILED.");
          console.error(err);
      }
  };

  const handleCloudLoad = async (filename: string) => {
      setState(prev => ({ ...prev, status: 'loading' }));
      setLoadingMessage('>> DOWNLOADING ENCRYPTED PACKET FROM CLOUD STORAGE...');
      try {
          const t = await fetchCloudTransmission(filename);
          // Save locally so we can view it
          await saveTransmission(t); 
          await loadLocalArchives();
          setState({ transmission: t, status: 'viewing' });
      } catch (e) {
          setState(prev => ({ ...prev, status: 'setup', error: "Download Failed." }));
      }
  };

  // --- Render ---

  if (state.status === 'setup') {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-black overflow-hidden font-mono text-gray-400">
        {showKeyModal && (
            <ApiKeyModal 
                onClose={() => setShowKeyModal(false)}
                onSubmit={handleManualKeySubmit}
            />
        )}
        
        {/* LEFT COLUMN: Controls */}
        <div className="w-full md:w-1/2 p-6 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-cyan-900/30 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-900 to-transparent opacity-50" />
          
          <div className="max-w-md w-full mx-auto space-y-10">
            <div>
              <h1 className="text-4xl md:text-5xl font-orbitron text-cyan-400 cyber-glow tracking-tighter italic uppercase">Technoir</h1>
              <p className="text-cyan-900 text-[10px] uppercase tracking-[0.5em] font-bold mt-1">Transmission Engine v2.1</p>
            </div>

            {/* Login / Auth Section */}
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider border-b border-gray-900 pb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${user || hasManualKey ? 'bg-green-500 cyber-glow' : 'bg-red-900'}`} />
                    <span>{user ? `OPERATOR: ${user.name}` : (hasManualKey ? 'GUEST_OPERATOR' : 'NO_AUTH_UPLINK')}</span>
                    {user?.isMaster && <span className="text-yellow-500 font-bold">[MASTER]</span>}
                </div>
                {!user ? (
                   <div className="flex gap-2">
                       <button onClick={signIn} className="text-cyan-600 hover:text-cyan-400 border border-cyan-900/50 px-2 py-1">
                           Google_Login
                       </button>
                       <button onClick={() => setShowKeyModal(true)} className="text-gray-500 hover:text-gray-300 px-2 py-1">
                           Input_Key
                       </button>
                   </div>
                ) : (
                    <div className="text-gray-600">Secure Connection</div>
                )}
            </div>

            {/* Generator */}
            <div className="cyber-border p-6 md:p-8 bg-gray-950/30 space-y-6 relative">
                 {/* Lock overlay if not auth */}
                 {!canGenerate && (
                     <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 space-y-4">
                         <div className="text-red-600 font-orbitron text-xl">ACCESS DENIED</div>
                         <p className="text-xs text-gray-500">Authentication required to initiate new transmissions.</p>
                         <div className="flex gap-4">
                             <button onClick={signIn} className="bg-cyan-950 text-cyan-400 px-4 py-2 border border-cyan-600 hover:bg-cyan-900 text-xs font-bold tracking-widest uppercase">
                                 Operator Login
                             </button>
                         </div>
                     </div>
                 )}

                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-cyan-700 text-[10px] font-bold uppercase tracking-[0.2em]">Parameter_Input</h2>
                        {canGenerate && (
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-3 h-3 border ${isBulkGenerating ? 'bg-cyan-500 border-cyan-500' : 'border-gray-700'} transition-colors`} />
                                <input type="checkbox" className="hidden" checked={isBulkGenerating} onChange={e => setIsBulkGenerating(e.target.checked)} />
                                <span className={`text-[9px] uppercase tracking-wider ${isBulkGenerating ? 'text-cyan-400' : 'text-gray-600 group-hover:text-gray-400'}`}>Full_Gen (Slow)</span>
                            </label>
                        )}
                    </div>
                    
                    <textarea
                        className="w-full bg-black border border-cyan-900/50 p-4 text-xs font-mono text-cyan-100 focus:border-cyan-500 outline-none h-32 transition-all resize-none placeholder-cyan-900"
                        value={themeInput}
                        onChange={(e) => setThemeInput(e.target.value)}
                        placeholder="Define Simulation Parameters (Theme, Year, Conflict)..."
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className="w-full py-4 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 transition-all font-orbitron uppercase text-xs tracking-[0.4em] text-cyan-400 group overflow-hidden relative disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="group-hover:tracking-[0.5em] transition-all relative z-10">GENERATE_TRANSMISSION</span>
                        <div className="absolute inset-0 bg-cyan-500/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                    </button>
                    {state.error && <p className="text-red-900 text-[10px] text-center uppercase font-bold">{state.error}</p>}
                 </div>
            </div>
            
            {hasManualKey && (
                <div className="text-center">
                    <button onClick={handleDisconnectKey} className="text-[9px] text-red-900 hover:text-red-600 uppercase tracking-widest">[ Disconnect_Manual_Key ]</button>
                </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Archives */}
        <div className="w-full md:w-1/2 bg-gray-950 p-6 md:p-12 overflow-y-auto">
            <div className="max-w-md w-full mx-auto space-y-6">
                
                {/* Tabs */}
                <div className="flex gap-4 border-b border-gray-900 pb-1">
                    <button 
                        onClick={() => setViewMode('cloud')}
                        className={`text-[10px] uppercase tracking-[0.2em] font-bold pb-2 px-2 transition-colors ${viewMode === 'cloud' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-700 hover:text-gray-500'}`}
                    >
                        Public_Network
                    </button>
                    <button 
                        onClick={() => setViewMode('local')}
                        className={`text-[10px] uppercase tracking-[0.2em] font-bold pb-2 px-2 transition-colors ${viewMode === 'local' ? 'text-green-500 border-b-2 border-green-500' : 'text-gray-700 hover:text-gray-500'}`}
                    >
                        Local_Drive
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">
                        {viewMode === 'cloud' ? 'Featured Transmissions (Read Only)' : 'Your Saved Data'}
                    </div>
                    {viewMode === 'local' && (
                        <div className="flex gap-2">
                            <input type="file" ref={fileInputRef} onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if(f) { await importTransmission(f); loadLocalArchives(); }
                            }} className="hidden" accept=".json,.json.gz,.gz" />
                            <button onClick={() => fileInputRef.current?.click()} className="text-[9px] text-cyan-800 hover:text-cyan-400 uppercase">[ Import ]</button>
                        </div>
                    )}
                </div>

                <div className="space-y-2 min-h-[300px]">
                    {viewMode === 'cloud' ? (
                        cloudArchives.length === 0 ? (
                            <div className="text-center py-10 opacity-30 text-[10px] uppercase">Connecting to Satellite...</div>
                        ) : (
                            cloudArchives.map(arch => (
                                <div key={arch.id} className="group relative border border-gray-900 bg-black/40 p-4 hover:border-cyan-800 transition-all flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div className="text-cyan-400 text-xs font-bold uppercase truncate font-orbitron max-w-[200px]">{arch.title}</div>
                                        <span className="text-gray-700 text-[9px] font-mono">{new Date(arch.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-[9px] text-gray-600 line-clamp-2 italic">{arch.summary}</div>
                                    <button 
                                        onClick={() => handleCloudLoad(arch.filename)}
                                        className="mt-2 w-full text-[9px] bg-cyan-950/20 hover:bg-cyan-900 text-cyan-600 border border-cyan-900/50 py-2 uppercase tracking-wider transition-colors"
                                    >
                                        Download_Packet
                                    </button>
                                </div>
                            ))
                        )
                    ) : (
                        localArchives.length === 0 ? (
                            <div className="text-center py-10 opacity-30 text-[10px] uppercase">Local Drive Empty</div>
                        ) : (
                            localArchives.map(arch => (
                                <div key={arch.id} className="group relative border border-green-900/30 bg-black/40 p-4 hover:border-green-600/50 transition-all flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div className="text-green-500/80 text-xs font-bold uppercase truncate font-orbitron max-w-[200px]">{arch.title}</div>
                                        <span className="text-gray-700 text-[9px] font-mono">{arch.createdAt}</span>
                                    </div>
                                    <div className="text-[9px] text-gray-600 line-clamp-2 italic">{arch.settingSummary}</div>
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
                                        <button 
                                            onClick={() => setState({ transmission: arch, status: 'viewing' })}
                                            className="flex-1 text-[9px] bg-green-950/20 hover:bg-green-900 text-green-600 border border-green-900/50 py-1 uppercase tracking-wider transition-colors"
                                        >
                                            Open
                                        </button>
                                        <button onClick={(e) => exportTransmission(arch)} className="text-[9px] text-gray-600 hover:text-white px-1 uppercase" title="Export">Exp</button>
                                        <button onClick={async (e) => { 
                                            e.stopPropagation(); 
                                            if(confirm('Delete?')) { await deleteTransmission(arch.id); loadLocalArchives(); } 
                                        }} className="text-[9px] text-red-900 hover:text-red-500 px-1 uppercase" title="Delete">Del</button>
                                        {user?.isMaster && (
                                            <button onClick={(e) => handleCloudUpload(arch, e)} className="text-[9px] text-yellow-700 hover:text-yellow-500 px-1 uppercase" title="Upload to Cloud">Cloud</button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (state.status === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-cyan-500 p-6 text-center">
        <div className="w-16 h-16 border-4 border-cyan-950 border-t-cyan-500 rounded-full animate-spin mb-6" />
        <p className="font-mono text-[10px] md:text-xs whitespace-pre-wrap max-w-xl leading-relaxed text-left border border-cyan-900/30 p-4 bg-cyan-950/10 min-w-[300px] max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loadingMessage}
          <span className="inline-block w-2 h-4 bg-cyan-500 ml-1 animate-pulse" />
        </p>
      </div>
    );
  }

  // Viewer Mode (Mostly unchanged logic, just cleaner props passing)
  const t = state.transmission!;

  const handleUpdateLead = async (updatedLead: Lead) => {
    // Logic duplicated for brevity, ideally extracted to helper
    setState(prev => {
        if (!prev.transmission) return prev;
        const existingLead = prev.transmission.leads.find(l => l.id === updatedLead.id);
        let finalLead = { ...updatedLead };
        if (existingLead && (existingLead.name !== updatedLead.name || existingLead.description !== updatedLead.description)) {
            finalLead.details = undefined; 
        } else {
            finalLead.details = existingLead?.details;
        }
        const newLeads = prev.transmission.leads.map(l => l.id === finalLead.id ? finalLead : l);
        const updatedTransmission = { ...prev.transmission, leads: newLeads };
        saveTransmission(updatedTransmission).catch(console.error);
        return { ...prev, transmission: updatedTransmission };
    });
  };

  const handleInspectLead = async (lead: Lead) => {
    if (lead.details) {
      setActiveLead({ lead, details: lead.details });
      setTimeout(() => setIsImageRevealed(true), 100);
      return;
    }

    if (!canGenerate) {
        setShowKeyModal(true);
        return;
    }

    setActiveLead({ lead });
    setIsImageRevealed(false);
    
    try {
      const textDetails = await generateLeadInspectionText(lead, t.title, t.settingSummary, t.exposition);
      const leadWithText = { ...lead, details: { ...textDetails, expandedDescription: textDetails.expandedDescription } };
      setActiveLead({ lead: leadWithText, details: leadWithText.details });

      const imageUrl = await generateLeadInspectionImage(lead, t.title, t.settingSummary, textDetails.sensory.sight);
      const finalDetails = { ...textDetails, imageUrl };
      
      setState(prev => {
        if (!prev.transmission) return prev;
        const updatedTransmission = {
          ...prev.transmission,
          leads: prev.transmission.leads.map(l => l.id === lead.id ? { ...l, details: finalDetails } : l)
        };
        saveTransmission(updatedTransmission);
        return { ...prev, transmission: updatedTransmission };
      });
      setActiveLead({ lead: { ...lead, details: finalDetails }, details: finalDetails });
      setTimeout(() => setIsImageRevealed(true), 300);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 font-mono overflow-y-auto pb-20">
      {showKeyModal && (
          <ApiKeyModal 
              onClose={() => setShowKeyModal(false)}
              onSubmit={handleManualKeySubmit}
          />
      )}
      
      <div className="relative group min-h-[40vh] md:h-[50vh] w-full overflow-hidden border-b border-cyan-900/30 shadow-[0_10px_30px_rgba(0,0,0,1)] flex flex-col justify-end bg-gray-900">
        {t.headerImageUrl ? (
          <img src={t.headerImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-1000" alt="Transmission Header" />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-gray-900 to-black animate-pulse flex items-center justify-center">
             <span className="text-[10px] font-orbitron tracking-[0.5em] text-cyan-900 uppercase">Rendering Visuals...</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
        
        <div className="absolute top-4 right-4 md:top-10 md:right-10 z-20 flex gap-2">
            <button 
            onClick={() => { setState({ transmission: null, status: 'setup' }); loadLocalArchives(); }}
            className="text-[9px] md:text-[10px] font-bold text-cyan-900 hover:text-cyan-400 uppercase tracking-widest border border-cyan-950 p-2 px-3 md:px-4 transition-all bg-black/80 backdrop-blur-sm"
            >
            CLOSE_TRANSMISSION
            </button>
        </div>

        <div className="relative p-6 md:p-10 md:left-10 lg:left-20 z-10 max-w-full">
          <h1 className="text-3xl md:text-5xl lg:text-7xl font-orbitron text-white cyber-glow uppercase italic tracking-tighter leading-tight break-words">
            {t.title}
          </h1>
          <p className="text-cyan-500 font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase mt-2 max-w-2xl text-xs md:text-sm">
            {t.settingSummary}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-20 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-12">
          {['technology', 'society', 'environment'].map((key) => (
            <section key={key} className="space-y-4">
              <h2 className="text-cyan-800 text-[10px] font-bold uppercase tracking-[0.5em] border-b border-cyan-950 pb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-cyan-600 rounded-full" /> EXPOSITION: {key.toUpperCase()}
              </h2>
              <p className="text-sm leading-relaxed text-gray-400 font-light">{(t.exposition as any)[key]}</p>
            </section>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-cyan-950/50 pb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] px-4 py-2 text-cyan-400 border-b-2 border-cyan-400">
              TRANSMISSION_LEADS
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {CATEGORIES.map(cat => (
              <div key={cat} className="space-y-4">
                <h3 className="text-xs font-orbitron text-cyan-600 uppercase tracking-[0.3em] bg-cyan-950/20 p-2 border-l-2 border-cyan-600">{cat}</h3>
                <div className="space-y-2">
                  {t.leads.filter(l => l.category === cat).map(lead => (
                    <LeadCard 
                        key={lead.id} 
                        lead={lead} 
                        onInspect={handleInspectLead}
                        onUpdate={handleUpdateLead}
                        apiKeySelected={canGenerate}
                        onConnectKey={() => setShowKeyModal(true)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeLead && (
        <LeadDossier 
          lead={activeLead.lead} 
          details={activeLead.details} 
          isRevealed={isImageRevealed}
          onClose={() => setActiveLead(null)} 
        />
      )}
    </div>
  );
};

// ... LeadCard, LeadDossier, ApiKeyModal ... (Same as previous, just ensure ApiKeyModal is available)
// For brevity, I am reusing the previously defined subcomponents.
// I will just redefine LeadCard/LeadDossier/ApiKeyModal briefly to ensure the file is complete.

const LeadCard: React.FC<{
    lead: Lead;
    onInspect: (lead: Lead) => void;
    onUpdate: (lead: Lead) => void;
    apiKeySelected: boolean;
    onConnectKey: () => void;
}> = ({ lead, onInspect, onUpdate, apiKeySelected, onConnectKey }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(lead.name);
    const [desc, setDesc] = useState(lead.description);

    if (isEditing) {
         return (
             <div className="p-4 bg-gray-950 border border-cyan-600/50 relative">
                 <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-cyan-800 p-1 mb-2 text-xs text-cyan-200" />
                 <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-black border border-cyan-800 p-1 text-[10px] text-gray-300 h-16" />
                 <div className="flex gap-2 justify-end mt-2">
                     <button onClick={() => setIsEditing(false)} className="text-[9px] text-red-500">CANCEL</button>
                     <button onClick={() => { onUpdate({...lead, name, description: desc}); setIsEditing(false); }} className="text-[9px] text-green-500">SAVE</button>
                 </div>
             </div>
         )
    }

    return (
        <div 
          onClick={() => isEditing ? null : (lead.details || apiKeySelected ? onInspect(lead) : onConnectKey())}
          className={`group p-4 bg-gray-950/50 border ${lead.details ? 'border-cyan-900/50' : 'border-gray-900'} hover:border-cyan-800 cursor-pointer transition-all relative overflow-hidden min-h-[100px]`}
        >
          {lead.details && <div className="absolute top-0 right-0 w-full h-full bg-cyan-900/5 pointer-events-none" />}
          <div className={`absolute top-0 right-0 w-0.5 h-full ${lead.details ? 'bg-cyan-500' : 'bg-cyan-900'} group-hover:bg-cyan-400 transition-all`} />
          <div className="flex justify-between items-start">
            <h4 className={`text-sm font-bold ${lead.details ? 'text-cyan-200' : 'text-white'} group-hover:text-cyan-400 transition-colors uppercase tracking-tight pr-6`}>{lead.name}</h4>
            {lead.details && <div className="absolute top-4 right-4 text-[8px] text-cyan-600 border border-cyan-900 px-1 uppercase">FILE_OPEN</div>}
          </div>
          <p className="text-[10px] text-gray-500 mt-1 group-hover:text-gray-400 italic pr-4">{lead.description}</p>
          <button onClick={(e) => {e.stopPropagation(); setIsEditing(true);}} className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-cyan-800 hover:text-cyan-400 uppercase">[ EDIT ]</button>
        </div>
    );
}

const ApiKeyModal: React.FC<{ onClose: () => void; onSubmit: (key: string) => void; }> = ({ onClose, onSubmit }) => {
    const [input, setInput] = useState('');
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
            <div className="w-full max-w-lg cyber-border bg-black p-8 relative">
                 <button onClick={onClose} className="absolute top-4 right-4 text-cyan-900 hover:text-cyan-400">X</button>
                 <h2 className="text-xl font-orbitron text-red-600 uppercase mb-4">Manual Override</h2>
                 <p className="text-[10px] text-gray-500 mb-4">Enter Gemini API Key to bypass security protocols.</p>
                 <input type="password" value={input} onChange={(e) => setInput(e.target.value)} className="w-full bg-black border border-cyan-900 p-3 text-cyan-400 text-xs mb-4" placeholder="AIza..." autoFocus />
                 <div className="flex gap-4">
                     <button onClick={onClose} className="flex-1 py-2 border border-red-900 text-red-800 text-[10px]">CANCEL</button>
                     <button onClick={() => onSubmit(input)} className="flex-1 py-2 bg-cyan-950 text-cyan-400 border border-cyan-600 text-[10px]">CONNECT</button>
                 </div>
            </div>
        </div>
    );
};

const LeadDossier: React.FC<{ lead: Lead; details?: LeadDetails; isRevealed: boolean; onClose: () => void }> = ({ lead, details, isRevealed, onClose }) => {
  const { displayedText: dossierText, isComplete: dossierDone } = useTypewriter(details?.expandedDescription || '', 4, !!details?.expandedDescription);
  const hasImage = !!details?.imageUrl;
  let scanClass = isRevealed && hasImage ? "revealed" : (dossierDone && !hasImage ? "scanning-up" : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-sm overflow-hidden">
      <div className="w-full h-full md:max-w-6xl md:h-[90vh] border border-cyan-900/50 bg-black flex flex-col md:flex-row shadow-[0_0_100px_rgba(0,0,0,1)]">
        <div className={`w-full h-[40%] md:h-full md:w-[45%] bg-gray-950 relative border-r border-cyan-950/30 flex items-center justify-center overflow-hidden shrink-0 scan-reveal ${scanClass}`}>
          <div className="scan-line" />
          {details?.imageUrl ? <img src={details.imageUrl} className="w-full h-full object-cover opacity-80" alt={lead.name} /> : <div className="text-[10px] text-cyan-800 animate-pulse">NO VISUAL DATA</div>}
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black to-transparent"><h2 className="text-3xl font-orbitron text-white uppercase italic">{lead.name}</h2></div>
        </div>
        <div className="flex-1 flex flex-col relative bg-black p-6 md:p-12 overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 bg-black/80 border border-cyan-900 p-2 text-cyan-400 rounded-full">X</button>
          <div className="grid grid-cols-2 gap-4 mb-8">
              {details && Object.entries(details.sensory).map(([k, v]) => <div key={k}><div className="text-[9px] text-cyan-900 uppercase">{k}</div><div className="text-[10px] text-gray-400 italic">{v}</div></div>)}
          </div>
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-cyan-700 uppercase border-b border-cyan-950 pb-2">Dossier</h3>
            <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-light whitespace-pre-wrap">{dossierText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SensoryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="space-y-1"><div className="text-[9px] text-cyan-900 uppercase">{label}</div><div className="text-[10px] text-gray-400">{value}</div></div>
);

export default App;
