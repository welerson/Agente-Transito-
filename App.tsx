
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, Infraction, Natureza } from './types';
import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot,
  writeBatch,
  getDocs,
  increment,
  query,
  orderBy,
  limit
} from 'firebase/firestore';

// PDF.js worker setup
declare const pdfjsLib: any;
if (typeof window !== 'undefined' && 'pdfjsLib' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const Icons = {
  Search: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  History: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Admin: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002 2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  ArrowLeft: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  File: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
};

const NatureTag: React.FC<{ natureza: Natureza }> = ({ natureza }) => {
  const colors = {
    [Natureza.LEVE]: 'bg-blue-100 text-blue-700',
    [Natureza.MEDIA]: 'bg-green-100 text-green-700',
    [Natureza.GRAVE]: 'bg-yellow-100 text-yellow-800',
    [Natureza.GRAVISSIMA]: 'bg-red-100 text-red-700',
    [Natureza.NAO_APLICAVEL]: 'bg-slate-100 text-slate-700',
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border border-current/10 ${colors[natureza] || colors[Natureza.NAO_APLICAVEL]}`}>{natureza}</span>;
};

const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 10));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'admin'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchStatus, setBatchStatus] = useState('');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'infractions'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Infraction[];
      setInfractions(data);
    });
    return () => unsub();
  }, []);

  const filteredInfractions = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return [];
    return infractions
      .filter(i => 
        i.codigo_enquadramento?.includes(q) || 
        i.titulo_curto?.toLowerCase().includes(q) || 
        i.artigo?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [debouncedSearch, infractions]);

  // MOTOR DE EXTRAÇÃO MBFT COM CORREÇÃO DE NATUREZA (GRAVIDADE)
  const processPDF = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setBatchStatus('Iniciando análise MBFT...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allFichas: Partial<Infraction>[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Preserva strings limpas
        const strings = textContent.items.map((item: any) => item.str.trim()).filter((s: string) => s.length > 0);
        const fullText = strings.join(' ');

        // Captura do Código (Padrão 000-00)
        const codigoMatch = fullText.match(/(\d{3}-\d{2})/);
        const codigo = codigoMatch ? codigoMatch[1] : null;
        if (!codigo) continue;

        // Captura do Artigo
        const artigoMatch = fullText.match(/Art\.\s+\d+[^\s]*/i);
        const artigo = artigoMatch ? artigoMatch[0] : 'MBFT';

        // CAPTURA DE TÍTULO (Tipificação Resumida)
        let titulo = "";
        const idxResumida = strings.findIndex(s => s.toLowerCase().includes("tipificação resumida:"));
        const idxCodigoLabel = strings.findIndex(s => s.toLowerCase().includes("código do enquadramento:"));
        if (idxResumida !== -1 && idxCodigoLabel !== -1) {
          titulo = strings.slice(idxResumida + 1, idxCodigoLabel).join(' ').trim();
        }

        // CAPTURA DE DESCRIÇÃO (Tipificação do Enquadramento)
        let descricao = "";
        const idxEnquadramento = strings.findIndex(s => s.toLowerCase().includes("tipificação do enquadramento:"));
        const idxGravidadeLabel = strings.findIndex(s => s.toLowerCase().includes("gravidade:"));
        if (idxEnquadramento !== -1 && idxGravidadeLabel !== -1) {
          descricao = strings.slice(idxEnquadramento + 1, idxGravidadeLabel).join(' ').trim();
        }

        // CAPTURA DE NATUREZA (GRAVIDADE) - Lógica Robusta de Procura Linear
        let natureza: Natureza = Natureza.NAO_APLICAVEL;
        if (idxGravidadeLabel !== -1) {
          // Varre as próximas strings até encontrar uma palavra chave de natureza ou o próximo rótulo ("Penalidade")
          const searchRange = strings.slice(idxGravidadeLabel + 1, idxGravidadeLabel + 10);
          const gravidadeText = searchRange.join(' ').toLowerCase();
          
          if (gravidadeText.includes("gravíssima")) natureza = Natureza.GRAVISSIMA;
          else if (gravidadeText.includes("grave")) natureza = Natureza.GRAVE;
          else if (gravidadeText.includes("média") || gravidadeText.includes("media")) natureza = Natureza.MEDIA;
          else if (gravidadeText.includes("leve")) natureza = Natureza.LEVE;
        }

        // Divisão das colunas inferiores
        const sections = fullText.split(/(Quando AUTUAR|Quando NÃO Autuar|Definições e Procedimentos|Exemplos do Campo de Observações do AIT:)/i);
        const getSection = (header: string) => {
          const idx = sections.findIndex(s => s.toLowerCase() === header.toLowerCase());
          return idx !== -1 ? sections[idx + 1].trim() : "Informação não disponível nesta ficha.";
        };

        allFichas.push({
          id: codigo,
          codigo_enquadramento: codigo,
          artigo: artigo,
          titulo_curto: titulo || `Infração ${codigo}`,
          descricao: descricao || titulo,
          natureza: natureza,
          quando_atuar: [getSection("Quando AUTUAR")],
          quando_nao_atuar: [getSection("Quando NÃO Autuar")],
          definicoes_procedimentos: [getSection("Definições e Procedimentos")],
          exemplos_ait: [getSection("Exemplos do Campo de Observações do AIT:")],
          status: 'ativo'
        });

        setProgress(Math.round((i / pdf.numPages) * 100));
        await yieldToBrowser();
      }

      // Commit em Lote para Firestore
      let batch = writeBatch(db);
      let count = 0;
      for (const ficha of allFichas) {
        const ref = doc(db, 'infractions', ficha.id!);
        batch.set(ref, { 
          ...ficha, 
          ultima_atualizacao: new Date().toISOString(),
          count_atuacoes: 0
        }, { merge: true });
        
        count++;
        if (count >= 400) { 
          await batch.commit(); 
          batch = writeBatch(db); 
          count = 0; 
        }
      }
      if (count > 0) await batch.commit();
      
      alert(`Importação Concluída: ${allFichas.length} infrações com naturezas mapeadas.`);
      setIsAdminPanelOpen(false);
    } catch (e) {
      console.error(e);
      alert("Erro no processamento do manual.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setBatchStatus('');
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm("⚠️ APAGAR TODA A BASE DE DADOS?")) return;
    setIsProcessing(true);
    setBatchStatus('Limpando base...');
    try {
      const querySnapshot = await getDocs(collection(db, 'infractions'));
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of querySnapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
      alert("Base de dados limpa.");
    } catch (e) { alert("Erro ao limpar."); } finally { setIsProcessing(false); setBatchStatus(''); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col justify-center px-10 relative">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white italic tracking-tighter">Multas Rápidas</h1>
          <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-2">Fiscalização Oficial MBFT</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-4">
          <input type="email" placeholder="E-mail Funcional" className="w-full p-5 bg-slate-50 rounded-3xl outline-none font-bold text-slate-800" id="login-email" />
          <button onClick={() => {
            const email = (document.getElementById('login-email') as HTMLInputElement).value;
            if (!email) return;
            setUser({ id: 'agt-' + Date.now(), name: 'Agente', email, role: email.includes('admin') ? UserRole.GESTOR : UserRole.AGENTE });
          }} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl btn-active">Acessar</button>
        </div>
        <div className="absolute bottom-10 left-0 right-0 text-center">
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest opacity-40">Desenvolvido por Welerson Faria - GCMIII - 2025</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden safe-top">
      <header className="bg-blue-800 text-white px-6 pt-6 pb-8 sticky top-0 z-20 shadow-xl rounded-b-[2.5rem] border-b-4 border-blue-900/20">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic">Multas Rápidas</h1>
            <span className="text-[9px] font-bold text-blue-300 uppercase">{user.role} ONLINE</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-50 active:scale-90 transition-transform"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center text-blue-400 group-focus-within:text-blue-200 transition-colors"><Icons.Search /></div>
            <input className="w-full pl-14 pr-6 py-4 bg-blue-900/40 border border-blue-700/50 rounded-3xl text-white outline-none font-bold text-sm placeholder-blue-300/50" placeholder="Busque pelo título ou código..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-40 no-scrollbar">
        {selectedInfraction ? (
          <div className="bg-white rounded-[3rem] shadow-2xl p-8 border border-slate-100 mb-10 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center mb-8">
               <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-5 py-3 rounded-full btn-active transition-all"><Icons.ArrowLeft /> Voltar</button>
               <span className="text-2xl font-black text-blue-600 tracking-tighter">{selectedInfraction.codigo_enquadramento}</span>
            </div>
            
            <div className="space-y-6">
              <NatureTag natureza={selectedInfraction.natureza} />
              <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Art. {selectedInfraction.artigo}</p>

              <div className="p-6 bg-slate-900 rounded-[2.5rem]">
                <p className="text-sm text-blue-100 italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="space-y-4">
                <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
                  <h4 className="text-[10px] font-black text-green-700 uppercase mb-3 tracking-widest">Quando Atuar</h4>
                  <div className="text-xs font-bold text-green-900 space-y-2 leading-relaxed">
                    {selectedInfraction.quando_atuar?.map((t, i) => <p key={i}>• {t}</p>)}
                  </div>
                </div>

                <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <h4 className="text-[10px] font-black text-red-700 uppercase mb-3 tracking-widest">Quando Não Atuar</h4>
                  <div className="text-xs font-bold text-red-900 space-y-2 leading-relaxed">
                    {selectedInfraction.quando_nao_atuar?.map((t, i) => <p key={i}>• {t}</p>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'search' && (
              debouncedSearch ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 flex flex-col gap-2 btn-active transition-all">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-xs font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight line-clamp-2">{inf.titulo_curto}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center text-slate-400">
                    <Icons.Search /><p className="font-black text-xs uppercase mt-4 tracking-widest">Pronto para pesquisar</p>
                  </div>
                </div>
              )
            )}

            {activeTab === 'admin' && user.role === UserRole.GESTOR && (
              <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-end px-2">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Gestão</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atualização Manual MBFT</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleClearDatabase} disabled={isProcessing} className="bg-red-500 text-white p-4 rounded-2xl shadow-xl active:scale-90 transition-all disabled:opacity-30"><Icons.Trash /></button>
                    <button onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)} className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 transition-all"><Icons.Plus /></button>
                  </div>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-blue-50 space-y-6 animate-in zoom-in-95 duration-200">
                    <button 
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                        className="w-full py-10 bg-slate-900 text-white rounded-[2rem] flex flex-col items-center justify-center gap-3 btn-active border-4 border-slate-800"
                    >
                        <Icons.File />
                        <div className="text-center">
                          <span className="text-[10px] font-black uppercase block">Carregar PDF MBFT</span>
                          <span className="text-[8px] opacity-40 uppercase">Extração Inteligente de Gravidade</span>
                        </div>
                    </button>

                    {isProcessing && (
                        <div className="text-center pt-2">
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3 border border-slate-200">
                                <div className="h-full bg-blue-600 animate-progress" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest animate-pulse">{batchStatus}</p>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && processPDF(e.target.files[0])} />
                  </div>
                )}
                
                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 mb-20">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Base de Dados ({infractions.length})</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                    {infractions.slice(0, 50).map(inf => (
                      <div key={inf.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.8rem] border border-slate-100">
                        <div className="truncate pr-4">
                          <p className="text-[10px] font-black text-blue-600">{inf.codigo_enquadramento}</p>
                          <p className="text-xs font-bold text-slate-800 truncate">{inf.titulo_curto}</p>
                        </div>
                        <NatureTag natureza={inf.natureza} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {!isAdminPanelOpen && (
               <div className="text-center pb-10 opacity-30">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Welerson Faria - GCMIII - 2025</p>
               </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-10 left-0 right-0 px-8 z-30">
          <nav className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-2xl rounded-[3.5rem] flex justify-around items-center p-3 border border-white/10 shadow-2xl safe-bottom">
            <button onClick={() => { setActiveTab('search'); setSelectedInfraction(null); }} className={`p-4 rounded-full transition-all duration-300 ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}><Icons.Search /></button>
            <button onClick={() => setActiveTab('history')} className={`p-4 rounded-full transition-all duration-300 ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}><Icons.History /></button>
            {user.role === UserRole.GESTOR && (
              <button onClick={() => setActiveTab('admin')} className={`p-4 rounded-full transition-all duration-300 ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}><Icons.Admin /></button>
            )}
          </nav>
      </div>
    </div>
  );
}
