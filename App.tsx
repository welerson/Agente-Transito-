
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, Infraction, Natureza } from './types';
import { INITIAL_INFRACTIONS } from './mockData';
import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  increment, 
  collection, 
  onSnapshot,
  addDoc,
  writeBatch
} from 'firebase/firestore';

// Configuração do PDF.js Global
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
  Flash: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 00-1 1v5H4a1 1 0 00-.832 1.554l7 10a1 1 0 001.664-1.108L10.832 11H17a1 1 0 00.832-1.554l-7-10A1 1 0 0011 3z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Upload: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>,
  File: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
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
  const [quickCode, setQuickCode] = useState('');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchStatus, setBatchStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'infractions'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Infraction[];
      if (data.length === 0) {
        INITIAL_INFRACTIONS.forEach(async (inf) => {
          await setDoc(doc(db, 'infractions', inf.id), inf);
        });
      } else {
        setInfractions(data);
      }
    });
    return () => unsub();
  }, []);

  const filteredInfractions = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return [];
    const results = [];
    for (const i of infractions) {
      if (!i.codigo_enquadramento || !i.titulo_curto) continue;
      const matchCode = i.codigo_enquadramento.includes(q);
      const matchTitle = i.titulo_curto.toLowerCase().includes(q);
      const matchArt = i.artigo?.toLowerCase().includes(q);
      if (matchCode || matchTitle || matchArt) results.push(i);
      if (results.length >= 30) break;
    }
    return results;
  }, [debouncedSearch, infractions]);

  const topInfractions = useMemo(() => {
    return [...infractions]
      .filter(i => (i.count_atuacoes || 0) > 0)
      .sort((a, b) => (b.count_atuacoes || 0) - (a.count_atuacoes || 0))
      .slice(0, 10);
  }, [infractions]);

  // PARSER REFORMULADO - Mais inteligente para MBFT
  const parseManualText = (text: string): Partial<Infraction> | null => {
    try {
      const clean = (str: string) => str ? str.trim().replace(/\s+/g, ' ') : '';
      
      const fields = {
        titulo_curto: /Tipificação Resumida:\s*([\s\S]*?)(?=Código do Enquadramento:|Amparo Legal:|Tipificação do Enquadramento:|Gravidade:|$)/i,
        codigo_enquadramento: /Código do Enquadramento:\s*([\d-]+)/i,
        artigo: /Amparo Legal:\s*([\s\S]*?)(?=Tipificação do Enquadramento:|Gravidade:|$)/i,
        descricao: /Tipificação do Enquadramento:\s*([\s\S]*?)(?=Gravidade:|Penalidade:|$)/i,
        penalidade: /Penalidade:\s*([\s\S]*?)(?=Medida Administrativa:|Pode Configurar:|$)/i,
        gravidade: /Gravidade:\s*([\s\S]*?)(?=Penalidade:|Infrator:|$)/i
      };

      const result: any = {
        quando_atuar: [],
        quando_nao_atuar: []
      };

      Object.entries(fields).forEach(([key, regex]) => {
        const match = text.match(regex);
        if (match) result[key] = clean(match[1]);
      });

      // Lógica de Natureza
      const grav = (result.gravidade || '').toLowerCase();
      if (grav.includes('leve')) result.natureza = Natureza.LEVE;
      else if (grav.includes('grave')) result.natureza = Natureza.GRAVE;
      else if (grav.includes('gravíssima')) result.natureza = Natureza.GRAVISSIMA;
      else if (grav.includes('não aplicável')) result.natureza = Natureza.NAO_APLICAVEL;
      else result.natureza = Natureza.MEDIA;

      if (!result.codigo_enquadramento) return null;
      if (!result.titulo_curto) result.titulo_curto = result.descricao?.substring(0, 80) || `Infração ${result.codigo_enquadramento}`;

      // EXTRATOR DE SEÇÕES "QUANDO ATUAR" E "NÃO ATUAR" (Mais robusto)
      const extractSection = (content: string, startRegex: RegExp, endRegex: RegExp) => {
        const startMatch = content.match(startRegex);
        if (!startMatch) return [];
        const startIndex = startMatch.index! + startMatch[0].length;
        const remaining = content.substring(startIndex);
        const endMatch = remaining.match(endRegex);
        const sectionText = endMatch ? remaining.substring(0, endMatch.index) : remaining;
        
        return sectionText
          .split('\n')
          .map(line => line.trim().replace(/^\d+[\s\.)-]*|^[•\-\*]\s*/, '')) // Limpa números e bullets
          .filter(line => line.length > 8) // Filtra frases curtas/lixo
          .slice(0, 10);
      }

      result.quando_atuar = extractSection(
        text, 
        /Quando AUTUAR[:\-\s]*/i, 
        /Quando NÃO Autuar|Definições e Procedimentos|Exemplos de AIT/i
      );

      result.quando_nao_atuar = extractSection(
        text, 
        /Quando NÃO Autuar[:\-\s]*/i, 
        /Definições e Procedimentos|Exemplos de AIT|O que observar/i
      );

      return result;
    } catch (e) { return null; }
  };

  const handleBulkImport = async (text: string) => {
    const blocks = text.split(/Tipificação Resumida:/i).filter(b => b.length > 50);
    let currentBatch = writeBatch(db);
    let countInBatch = 0;
    let totalImported = 0;

    for (let i = 0; i < blocks.length; i++) {
      if (i % 15 === 0) {
        await yieldToBrowser();
        setBatchStatus(`Ficha ${i + 1} de ${blocks.length}...`);
      }
      const fullText = `Tipificação Resumida: ${blocks[i]}`;
      const parsed = parseManualText(fullText);
      if (parsed && parsed.codigo_enquadramento) {
        const docRef = doc(db, 'infractions', parsed.codigo_enquadramento);
        currentBatch.set(docRef, {
          ...parsed,
          id: parsed.codigo_enquadramento,
          status: 'ativo',
          ultima_atualizacao: new Date().toISOString(),
          fonte_legal: parsed.artigo || 'MBFT',
          tags: [parsed.codigo_enquadramento, parsed.artigo || '']
        }, { merge: true });
        countInBatch++;
        totalImported++;
        if (countInBatch >= 400) {
          await currentBatch.commit();
          await yieldToBrowser();
          currentBatch = writeBatch(db);
          countInBatch = 0;
        }
      }
    }
    if (countInBatch > 0) await currentBatch.commit();
    return totalImported;
  };

  const processPDF = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setBatchStatus('Processando PDF...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += `\n Tipificação Resumida: ` + textContent.items.map((item: any) => item.str).join(' '); 
        if (i % 10 === 0) {
          setProgress(Math.round((i / pdf.numPages) * 100));
          await yieldToBrowser();
        }
      }
      const count = await handleBulkImport(fullText);
      alert(`${count} infrações importadas!`);
      setIsAdminPanelOpen(false);
    } catch (e) {
      alert('Erro ao ler PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPDF(file);
  };

  const handleRecord = async (inf: Infraction) => {
    if (!user) return;
    setIsRecording(true);
    try {
      const infRef = doc(db, 'infractions', inf.id);
      await updateDoc(infRef, { count_atuacoes: increment(1) });
      alert(`Atuação registrada em ${inf.codigo_enquadramento}`);
      setQuickCode('');
    } catch (e) { alert('Erro ao salvar'); } finally { setIsRecording(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col justify-center px-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tighter italic">Multas Rápidas</h1>
          <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-2">Versão 2.0 MBFT</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-4">
          <input 
            type="email" 
            placeholder="E-mail Funcional" 
            className="w-full p-5 bg-slate-50 rounded-3xl outline-none font-bold" 
            id="login-email" 
          />
          <button 
            onClick={() => {
              const email = (document.getElementById('login-email') as HTMLInputElement).value;
              if (!email) return;
              const role = email.toLowerCase().includes('admin') ? UserRole.GESTOR : UserRole.AGENTE;
              setUser({ id: 'agt-' + Date.now(), name: 'Agente', email, role });
            }}
            className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden safe-top">
      <header className="bg-blue-800 text-white px-6 pt-6 pb-8 sticky top-0 z-20 shadow-xl rounded-b-[2.5rem]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic">Multas Rápidas</h1>
            <span className="text-[9px] font-bold text-blue-300 uppercase">{user.role}</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-50"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                className="flex-1 px-5 py-4 bg-white/10 rounded-3xl text-white placeholder-white/40 outline-none font-black text-sm uppercase"
                placeholder="CÓDIGO (EX: 5010)"
                value={quickCode}
                onChange={e => setQuickCode(e.target.value)}
              />
              <button onClick={() => {
                const found = infractions.find(i => i.codigo_enquadramento.replace('-','') === quickCode.replace('-',''));
                if(found) setSelectedInfraction(found); else alert('Não encontrado');
              }} className="bg-orange-500 text-white px-6 rounded-3xl font-black text-xs">OK</button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center text-blue-400"><Icons.Search /></div>
              <input 
                className="w-full pl-14 pr-6 py-4 bg-blue-900/40 border border-blue-700/50 rounded-3xl text-white placeholder-blue-300/40 outline-none font-bold text-sm"
                placeholder="Busca rápida..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-40 no-scrollbar">
        {selectedInfraction ? (
          <div className="bg-white rounded-[3rem] shadow-2xl p-8 border border-slate-100 animate-in slide-in-from-bottom duration-300 mb-10">
            <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-5 py-3 rounded-full mb-8"><Icons.ArrowLeft /> Voltar</button>
            
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <NatureTag natureza={selectedInfraction.natureza} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Art. {selectedInfraction.artigo}</p>
              </div>
              <span className="text-3xl font-black text-blue-600">{selectedInfraction.codigo_enquadramento}</span>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              <div className="p-6 bg-slate-900 rounded-[2.5rem]">
                <p className="text-sm text-blue-100 italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="space-y-4">
                <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
                  <h4 className="text-[10px] font-black text-green-700 uppercase mb-3 tracking-widest">Quando Atuar</h4>
                  <ul className="text-xs font-bold text-green-900 space-y-2">
                    {selectedInfraction.quando_atuar?.length ? selectedInfraction.quando_atuar.map((t, i) => <li key={i}>• {t}</li>) : <li className="opacity-40">Nenhuma orientação encontrada</li>}
                  </ul>
                </div>
                <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <h4 className="text-[10px] font-black text-red-700 uppercase mb-3 tracking-widest">Não Atuar</h4>
                  <ul className="text-xs font-bold text-red-900 space-y-2">
                    {selectedInfraction.quando_nao_atuar?.length ? selectedInfraction.quando_nao_atuar.map((t, i) => <li key={i}>• {t}</li>) : <li className="opacity-40">Nenhuma restrição encontrada</li>}
                  </ul>
                </div>
              </div>

              <button 
                onClick={() => handleRecord(selectedInfraction)} 
                disabled={isRecording}
                className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-2xl disabled:bg-slate-300"
              >
                {isRecording ? 'SALVANDO...' : 'REGISTRAR ATUAÇÃO'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'search' && (
              debouncedSearch ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resultados ({filteredInfractions.length})</p>
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-xs font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight pr-4">{inf.titulo_curto}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                    <Icons.Search />
                    <p className="font-black text-xs uppercase mt-4 tracking-widest">Pesquise para começar</p>
                  </div>
                  {topInfractions.length > 0 && (
                    <div className="bg-white rounded-[3rem] p-8 shadow-xl">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 flex items-center gap-2"><Icons.Flash /> Mais Utilizadas</h3>
                        <div className="space-y-4">
                            {topInfractions.map(inf => (
                                <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full flex justify-between items-center text-left">
                                    <span className="text-sm font-black text-slate-700 truncate mr-2">{inf.titulo_curto}</span>
                                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">{inf.count_atuacoes}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                  )}
                </div>
              )
            )}

            {activeTab === 'admin' && user.role === UserRole.GESTOR && (
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900">Gestão</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Configuração da Base</p>
                  </div>
                  <button onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)} className="bg-blue-600 text-white px-6 py-4 rounded-[1.8rem] font-black text-xs uppercase shadow-xl"><Icons.Plus /></button>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-blue-50 space-y-6">
                    <h3 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2"><Icons.Upload /> Importador MBFT</h3>
                    <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`w-full py-12 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer ${isProcessing ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                        {isProcessing ? (
                            <div className="text-center w-full px-10">
                                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
                                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">{progress}%</p>
                                <p className="text-[9px] font-bold text-slate-600 mt-2">{batchStatus}</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="mx-auto w-12 h-12 mb-2 text-slate-300"><Icons.File /></div>
                                <p className="text-xs font-black uppercase text-slate-400">Selecionar PDF</p>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
                    </div>
                  </div>
                )}
                
                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Base de Dados ({infractions.length})</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                    {infractions.slice(0, 50).map(inf => (
                      <div key={inf.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.8rem]">
                        <div className="truncate flex-1 pr-4">
                          <p className="text-[10px] font-black text-blue-600">{inf.codigo_enquadramento}</p>
                          <p className="text-xs font-bold text-slate-800 truncate">{inf.titulo_curto}</p>
                        </div>
                        <button onClick={() => setSelectedInfraction(inf)} className="p-2 text-blue-500"><Icons.Search /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {!selectedInfraction && (
        <div className="fixed bottom-10 left-0 right-0 px-8 z-30">
            <nav className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-2xl rounded-[3.5rem] flex justify-around items-center p-3 border border-white/10 shadow-2xl safe-bottom">
              <button onClick={() => setActiveTab('search')} className={`p-4 rounded-full transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white scale-110' : 'text-slate-500'}`}><Icons.Search /></button>
              <button onClick={() => setActiveTab('history')} className={`p-4 rounded-full transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white scale-110' : 'text-slate-500'}`}><Icons.History /></button>
              {user.role === UserRole.GESTOR && (
                <button onClick={() => setActiveTab('admin')} className={`p-4 rounded-full transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white scale-110' : 'text-slate-500'}`}><Icons.Admin /></button>
              )}
            </nav>
        </div>
      )}
    </div>
  );
}
