
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, Infraction, Natureza } from './types';
import { INITIAL_INFRACTIONS } from './mockData';
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
  Json: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Flash: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 00-1 1v5H4a1 1 0 00-.832 1.554l7 10a1 1 0 001.664-1.108L10.832 11H17a1 1 0 00.832-1.554l-7-10A1 1 0 0011 3z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Add: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
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
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border border-current/10 ${colors[natureza] || colors[Natureza.NAO_APLICAVEL]}`}>{natureza}</span>;
};

const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

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
  const jsonInputRef = useRef<HTMLInputElement>(null);

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
    return infractions.filter(i => 
      i.codigo_enquadramento?.includes(q) || 
      i.titulo_curto?.toLowerCase().includes(q) ||
      i.artigo?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [debouncedSearch, infractions]);

  const topInfractions = useMemo(() => {
    return [...infractions]
      .filter(i => (i.count_atuacoes || 0) > 0)
      .sort((a, b) => (b.count_atuacoes || 0) - (a.count_atuacoes || 0))
      .slice(0, 5);
  }, [infractions]);

  // MOTOR DE EXTRAÇÃO BBOX (REGION-BASED) - SOLUÇÃO 1 & 2
  const processPDF = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setBatchStatus('Iniciando Extração por Regiões (Bbox)...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let allFichas: Partial<Infraction>[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        
        const w = viewport.width;
        const h = viewport.height;
        
        // Mapear itens com coordenadas reais
        const items = textContent.items.map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height
        }));

        // LOCALIZAÇÃO DINÂMICA DE TÍTULOS (ÂNCOURA Y)
        const labels = ["QUANDO AUTUAR", "QUANDO NÃO AUTUAR", "DEFINIÇÕES E PROCEDIMENTOS", "EXEMPLOS DO CAMPO"];
        let anchorY = 0;
        items.forEach(it => {
          if (it.str.toUpperCase().includes("QUANDO AUTUAR")) anchorY = it.y;
        });

        if (anchorY === 0) continue; // Página não é uma ficha técnica válida

        // DIVISÃO EM 4 CAIXAS VERTICAIS (BBOX)
        const colW = w / 4;
        const boxes = {
          atuar: [],
          naoAtuar: [],
          defs: [],
          exemplos: []
        };

        items.forEach(it => {
          // Ignorar o que estiver acima dos títulos ou no rodapé extremo
          if (it.y > anchorY - 5 || it.y < 40) return; 

          if (it.x < colW) boxes.atuar.push(it.str);
          else if (it.x < colW * 2) boxes.naoAtuar.push(it.str);
          else if (it.x < colW * 3) boxes.defs.push(it.str);
          else boxes.exemplos.push(it.str);
        });

        // Extração de metadados da parte superior da ficha (Código, Artigo, etc)
        let codigo = "";
        let artigo = "";
        let titulo = "";
        items.forEach(it => {
          if (it.y > anchorY + 20) {
            if (it.str.match(/\d{3}-\d{2}/)) codigo = it.str.trim();
            if (it.str.match(/Art\.\s+\d+/i)) artigo = it.str.trim();
          }
        });

        if (codigo) {
          allFichas.push({
            id: codigo,
            codigo_enquadramento: codigo,
            artigo: artigo || 'N/A',
            titulo_curto: titulo || `Ficha ${codigo}`,
            quando_atuar: [boxes.atuar.join(" ")],
            quando_nao_atuar: [boxes.naoAtuar.join(" ")],
            definicoes_procedimentos: [boxes.defs.join(" ")],
            exemplos_ait: [boxes.exemplos.join(" ")]
          });
        }

        setProgress(Math.round((i / pdf.numPages) * 100));
        await yieldToBrowser();
      }

      // Importação em massa
      let batch = writeBatch(db);
      let count = 0;
      for (const ficha of allFichas) {
        const ref = doc(db, 'infractions', ficha.id);
        batch.set(ref, { ...ficha, status: 'ativo', ultima_atualizacao: new Date().toISOString() }, { merge: true });
        count++;
        if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();
      
      alert(`${allFichas.length} fichas processadas com sucesso!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao processar PDF por Bbox.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setBatchStatus('');
    }
  };

  const handleJSONUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setBatchStatus('Processando JSON Estruturado...');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : [data];
      
      let batch = writeBatch(db);
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const id = item.codigo_enquadramento || item.codigo || item.id;
        if (!id) continue;
        
        const docRef = doc(db, 'infractions', id);
        batch.set(docRef, {
          ...item,
          id,
          codigo_enquadramento: id,
          status: 'ativo',
          ultima_atualizacao: new Date().toISOString(),
          count_atuacoes: item.count_atuacoes || 0
        }, { merge: true });
        
        count++;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
          setProgress(Math.round((i / list.length) * 100));
          await yieldToBrowser();
        }
      }
      if (count > 0) await batch.commit();
      alert(`Importação concluída: ${list.length} registros.`);
    } catch (e) {
      alert("Erro no JSON.");
    } finally {
      setIsProcessing(false);
      setBatchStatus('');
    }
  };

  const handleRecord = async (inf: Infraction) => {
    if (!user) return;
    try {
      const ref = doc(db, 'infractions', inf.id);
      await updateDoc(ref, { count_atuacoes: increment(1) });
      alert("Consulta registrada com sucesso.");
    } catch (e) { alert("Erro ao registrar."); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-black text-white italic tracking-tighter">MULTAS RÁPIDAS</h1>
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mt-2">Fiscalização Digital MBFT</p>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-4">
            <input id="login-email" type="email" placeholder="Seu e-mail funcional" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold text-slate-800" />
            <button onClick={() => {
              const email = (document.getElementById('login-email') as HTMLInputElement).value;
              if (!email) return;
              setUser({ id: 'agt-' + Date.now(), name: 'Agente', email, role: email.includes('admin') ? UserRole.GESTOR : UserRole.AGENTE });
            }} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-transform">Entrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden safe-top">
      {/* Header Compacto para Mobile */}
      <header className="bg-blue-800 text-white px-6 pt-6 pb-8 sticky top-0 z-20 shadow-xl rounded-b-[2rem] border-b-4 border-blue-900/20">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic">MULTAS RÁPIDAS</h1>
            <div className="flex items-center gap-1.5 opacity-60">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-bold uppercase tracking-wider">{user.role} ONLINE</span>
            </div>
          </div>
          <button onClick={() => setUser(null)} className="p-2 bg-white/10 rounded-full"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center text-blue-400 group-focus-within:text-blue-200"><Icons.Search /></div>
            <input 
              className="w-full pl-14 pr-6 py-4 bg-blue-900/40 border border-blue-700/50 rounded-2xl text-white outline-none font-bold text-sm placeholder-blue-300 focus:bg-blue-900/60 transition-all" 
              placeholder="Código, Artigo ou Descrição..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar">
        {selectedInfraction ? (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-5 py-3 rounded-xl active:scale-95 transition-all"><Icons.ArrowLeft /> Voltar</button>
            
            <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <NatureTag natureza={selectedInfraction.natureza} />
                <span className="text-3xl font-black text-blue-600 tracking-tighter">{selectedInfraction.codigo_enquadramento}</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight mb-4">{selectedInfraction.titulo_curto}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Art. {selectedInfraction.artigo}</p>
              
              <div className="p-5 bg-slate-900 rounded-2xl mb-8">
                <p className="text-sm text-blue-100 italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-[10px] font-black text-green-600 uppercase mb-3 tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> Quando Atuar
                  </h4>
                  <div className="text-xs text-slate-700 leading-relaxed bg-green-50/50 p-4 rounded-xl border border-green-100">
                    {selectedInfraction.quando_atuar?.map((t, i) => <p key={i} className="mb-2 last:mb-0">• {t}</p>)}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-red-600 uppercase mb-3 tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> Quando NÃO Atuar
                  </h4>
                  <div className="text-xs text-slate-700 leading-relaxed bg-red-50/50 p-4 rounded-xl border border-red-100">
                    {selectedInfraction.quando_nao_atuar?.map((t, i) => <p key={i} className="mb-2 last:mb-0">• {t}</p>)}
                  </div>
                </section>

                {selectedInfraction.definicoes_procedimentos && (
                  <section>
                    <h4 className="text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest">Definições e Procedimentos</h4>
                    <div className="text-[11px] text-slate-600 leading-relaxed bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      {selectedInfraction.definicoes_procedimentos.map((t, i) => <p key={i} className="mb-2 last:mb-0">{t}</p>)}
                    </div>
                  </section>
                )}

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-slate-100 p-4 rounded-xl text-center">
                     <p className="text-[8px] font-black text-slate-400 uppercase">Pontos</p>
                     <p className="text-xl font-black text-slate-800">{selectedInfraction.pontos}</p>
                   </div>
                   <div className="bg-slate-100 p-4 rounded-xl text-center">
                     <p className="text-[8px] font-black text-slate-400 uppercase">Penalidade</p>
                     <p className="text-[10px] font-black text-slate-800 truncate px-2">{selectedInfraction.penalidade}</p>
                   </div>
                </div>

                <button onClick={() => handleRecord(selectedInfraction)} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">REGISTRAR CONSULTA</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'search' && (
              debouncedSearch ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 active:bg-blue-50 active:scale-[0.98] transition-all">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-[10px] font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight">{inf.titulo_curto}</h3>
                      <p className="text-[10px] font-bold text-slate-400">Art. {inf.artigo}</p>
                    </button>
                  ))}
                  {filteredInfractions.length === 0 && (
                    <div className="text-center py-20 opacity-30">
                      <Icons.Search />
                      <p className="text-xs font-black uppercase mt-4 tracking-widest">Nenhuma infração encontrada</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {topInfractions.length > 0 && (
                    <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase mb-5 flex items-center gap-2 tracking-widest"><Icons.Flash /> MAIS CONSULTADAS</h3>
                      <div className="space-y-4">
                        {topInfractions.map((inf, i) => (
                          <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full flex justify-between items-center group active:scale-95 transition-transform">
                            <span className="text-xs font-black text-slate-700 truncate max-w-[70%]">{i+1}. {inf.titulo_curto}</span>
                            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{inf.count_atuacoes}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <Icons.Search />
                    <p className="text-[10px] font-black uppercase mt-4 tracking-widest text-center">Digite o código ou artigo<br/>para iniciar a fiscalização</p>
                  </div>
                </div>
              )
            )}

            {activeTab === 'admin' && user.role === UserRole.GESTOR && (
              <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">GESTÃO</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base de Dados Local</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition-all"><Icons.Add /></button>
                  </div>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-3xl p-6 shadow-xl border border-blue-50 space-y-4">
                    <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">Importar Base</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => jsonInputRef.current?.click()} className="flex flex-col items-center justify-center p-6 bg-slate-900 text-white rounded-2xl gap-2 active:scale-95 transition-all">
                        <Icons.Json /> <span className="text-[8px] font-black uppercase">JSON</span>
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-2xl gap-2 active:scale-95 transition-all">
                        <Icons.File /> <span className="text-[8px] font-black uppercase">PDF Bbox</span>
                      </button>
                    </div>
                    {isProcessing && (
                      <div className="pt-4">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-[9px] font-black text-blue-600 uppercase mt-2 text-center">{batchStatus}</p>
                      </div>
                    )}
                    <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleJSONUpload} />
                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && processPDF(e.target.files[0])} />
                  </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100">
                   <div className="flex justify-between items-center mb-6">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registros: {infractions.length}</h3>
                     <button onClick={() => { if(confirm("Apagar tudo?")) setDoc(doc(db, 'system', 'reset'), { timestamp: Date.now() }); }} className="text-red-500 p-2"><Icons.Trash /></button>
                   </div>
                   <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                     {infractions.slice(0, 50).map(inf => (
                       <div key={inf.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <div className="flex-1 min-w-0 pr-4">
                           <p className="text-[10px] font-black text-blue-600">{inf.codigo_enquadramento}</p>
                           <p className="text-[10px] font-bold text-slate-800 truncate">{inf.titulo_curto}</p>
                         </div>
                         <button onClick={() => setSelectedInfraction(inf)} className="p-2 text-blue-300"><Icons.Search /></button>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Nav Bar Flutuante */}
      {!selectedInfraction && (
        <div className="fixed bottom-8 left-0 right-0 px-8 z-30">
          <nav className="max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] flex justify-around items-center p-2 border border-white/10 shadow-2xl safe-bottom">
            <button onClick={() => setActiveTab('search')} className={`p-5 rounded-full transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'text-slate-500'}`}><Icons.Search /></button>
            <button onClick={() => setActiveTab('history')} className={`p-5 rounded-full transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'text-slate-500'}`}><Icons.History /></button>
            {user.role === UserRole.GESTOR && (
              <button onClick={() => setActiveTab('admin')} className={`p-5 rounded-full transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'text-slate-500'}`}><Icons.Admin /></button>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
