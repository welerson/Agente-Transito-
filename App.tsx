
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
  increment
} from 'firebase/firestore';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchStatus, setBatchStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
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

  // MOTOR DE EXTRAÇÃO MBFT 11.0 - CLUSTERING DINÂMICO
  const parseManualText = (rawText: string): Partial<Infraction> | null => {
    try {
      const content = rawText.replace(/\r\n/g, '\n');
      
      const headerPatterns = [
        { key: 'titulo_curto', regex: /Tipifica[çc][ãa]o\s+Resumida/i },
        { key: 'codigo_enquadramento', regex: /C[óo]digo\s+do\s+Enquadramento/i },
        { key: 'artigo', regex: /Amparo\s+Legal/i },
        { key: 'descricao', regex: /Tipifica[çc][ãa]o\s+do\s+Enquadramento/i },
        { key: 'gravidade', regex: /Gravidade/i },
        { key: 'penalidade', regex: /Penalidade/i },
        { key: 'medida_admin', regex: /Medida\s+Administrativa/i },
        { key: 'atuar_header', regex: /Quando\s+AUTUAR/i },
        { key: 'nao_atuar_header', regex: /Quando\s+N[ÃA]O\s+Autuar/i },
        { key: 'defs_header', regex: /Defini[çc][õo]es\s+e\s+Procedimentos/i },
        { key: 'exemplos_header', regex: /Exemplos\s+do\s+Campo\s+de\s+Observa[çc][õo]es/i },
        { key: 'fim_ficha', regex: /CONSELHO\s+NACIONAL\s+DE\s+TR[ÃA]NSITO/i }
      ];

      const markers = headerPatterns.map(h => {
        const match = content.match(h.regex);
        return { key: h.key, label: match ? match[0] : null, index: match ? match.index : -1 };
      }).filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

      const sections: Record<string, string> = {};
      markers.forEach((marker, i) => {
        const start = marker.index! + marker.label!.length;
        const nextMarker = markers[i + 1];
        const end = nextMarker ? nextMarker.index : content.length;
        let segment = content.substring(start, end).trim();
        segment = segment.replace(/^[:\-\s\.]+/g, '').trim();
        sections[marker.key] = segment;
      });

      if (!sections.codigo_enquadramento) return null;

      // PROCESSADOR V11 - BASEADO EM CANAIS DE TEXTO (COLUNAS REAIS)
      const processTechnicalArea = () => {
        const atuar: string[] = [];
        const naoAtuar: string[] = [];
        const defs: string[] = [];
        const ex: string[] = [];

        const startIdx = markers.find(m => m.key === 'atuar_header')?.index || 0;
        const endIdx = markers.find(m => m.key === 'fim_ficha' && m.index > startIdx)?.index || content.length;
        const block = content.substring(startIdx, endIdx);
        
        const lines = block.split('\n').filter(l => l.trim().length > 1);
        let linearMode = false;

        lines.forEach(line => {
          const upper = line.toUpperCase();
          if (upper.includes("DEFINIÇÕES E PROCEDIMENTOS") || upper.includes("EXEMPLOS DO CAMPO")) {
            linearMode = true;
          }

          if (!linearMode) {
            // DETECTA SE A LINHA TEM O SEPARADOR DE COLUNA GERADO NO PROCESS_PDF
            if (line.includes("[COL_SEP]")) {
                const parts = line.split("[COL_SEP]");
                const left = parts[0]?.replace(/^\d+[\s\.\)]+/, '').trim();
                const right = parts[1]?.replace(/^\d+[\s\.\)]+/, '').trim();
                
                if (left && left.length > 3 && !left.toUpperCase().includes("QUANDO AUTUAR")) atuar.push(left);
                if (right && right.length > 3 && !right.toUpperCase().includes("QUANDO NÃO AUTUAR")) naoAtuar.push(right);
            } else {
                // Linha sem separador mas dentro da zona técnica: decidimos por contexto
                const clean = line.replace(/^\d+[\s\.\)]+/, '').trim();
                if (clean.length > 3 && !upper.includes("AUTUAR") && !upper.includes("CONSELHO")) {
                   // Se houver muito mais "atuar" que "não atuar", provavelmente é uma quebra de linha da esquerda
                   if (atuar.length > naoAtuar.length) atuar.push(clean);
                   else naoAtuar.push(clean);
                }
            }
          } else {
            const clean = line.replace(/^\d+[\s\.\)]+/, '').replace(/^•\s*/, '').trim();
            if (clean.length > 3 && !upper.includes("CONSELHO")) {
                if (upper.includes("EXEMPLOS") || ex.length > 0) ex.push(clean);
                else defs.push(clean);
            }
          }
        });

        return { atuar, naoAtuar, defs, ex };
      };

      const tech = processTechnicalArea();

      const result: Partial<Infraction> = {
        id: sections.codigo_enquadramento.match(/[\d-]+/)?.[0] || sections.codigo_enquadramento,
        codigo_enquadramento: sections.codigo_enquadramento.match(/[\d-]+/)?.[0] || sections.codigo_enquadramento,
        artigo: sections.artigo?.split('\n')[0].trim() || '',
        titulo_curto: sections.titulo_curto?.split('\n')[0].trim() || 'Ficha ' + sections.codigo_enquadramento,
        descricao: sections.descricao?.replace(/\n/g, ' ').trim() || '',
        quando_atuar: tech.atuar,
        quando_nao_atuar: tech.naoAtuar,
        definicoes_procedimentos: tech.defs,
        exemplos_ait: tech.ex,
        penalidade: sections.penalidade?.split('\n')[0].trim() || 'Multa',
        medidas_administrativas: sections.medida_admin ? [sections.medida_admin.split('\n')[0].trim()] : []
      };

      const grav = (sections.gravidade || '').toLowerCase();
      if (grav.includes('leve')) { result.natureza = Natureza.LEVE; result.pontos = 3; }
      else if (grav.includes('gravíssima')) { result.natureza = Natureza.GRAVISSIMA; result.pontos = 7; }
      else if (grav.includes('grave')) { result.natureza = Natureza.GRAVE; result.pontos = 5; }
      else if (grav.includes('méd')) { result.natureza = Natureza.MEDIA; result.pontos = 4; }
      else { result.natureza = Natureza.NAO_APLICAVEL; result.pontos = 0; }

      return result;
    } catch (e) {
      console.error("Erro no processador MBFT 11.0:", e);
      return null;
    }
  };

  const processPDF = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setBatchStatus('Iniciando Motor V11 (Dynamic Clustering)...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // 1. MAPEAMENTO DE ITENS COM COORDENADAS
        const items = textContent.items.map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width
        }));

        // 2. DETECÇÃO DINÂMICA DE COLUNAS (Clustering)
        // Encontra os X onde os textos mais começam
        const xStarts = items.map(it => Math.round(it.x)).sort((a,b) => a-b);
        const midPoint = xStarts[Math.floor(xStarts.length / 2)]; 
        // Em um PDF 2 colunas, o midPoint estatístico divide bem os clusters esquerda/direita

        // 3. AGRUPAMENTO POR LINHA (Y)
        const rows: Record<number, any[]> = {};
        items.forEach(item => {
          const yKey = Math.round(item.y / 3) * 3; // Tolerância fina de 3px
          if (!rows[yKey]) rows[yKey] = [];
          rows[yKey].push(item);
        });

        const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);
        let pageText = "";
        
        sortedY.forEach(y => {
          const rowItems = rows[y].sort((a, b) => a.x - b.x);
          
          let leftPart = "";
          let rightPart = "";
          
          rowItems.forEach(item => {
            // Se o item começa antes do ponto de equilíbrio estatístico, é coluna 1
            if (item.x < midPoint) leftPart += " " + item.str;
            else rightPart += " " + item.str;
          });

          if (leftPart.trim() && rightPart.trim()) {
            pageText += leftPart.trim() + " [COL_SEP] " + rightPart.trim() + "\n";
          } else {
            pageText += (leftPart.trim() || rightPart.trim()) + "\n";
          }
        });

        fullText += `\n\nCONSELHO NACIONAL DE TRÂNSITO\n` + pageText; 
        
        if (i % 5 === 0 || i === pdf.numPages) {
          setProgress(Math.round((i / pdf.numPages) * 100));
          setBatchStatus(`Lendo MBFT: página ${i} de ${pdf.numPages}...`);
          await yieldToBrowser();
        }
      }
      
      const importedCount = await handleBulkImport(fullText);
      alert(`SUCESSO: ${importedCount} infrações configuradas.`);
      setIsAdminPanelOpen(false);
    } catch (e) {
      alert('Erro no processamento do PDF.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setBatchStatus('');
    }
  };

  const handleBulkImport = async (text: string) => {
    const blocks = text.split(/CONSELHO\s+NACIONAL\s+DE\s+TR[ÃA]NSITO/i).filter(b => b.length > 200);
    let currentBatch = writeBatch(db);
    let countInBatch = 0;
    let totalImported = 0;

    for (let i = 0; i < blocks.length; i++) {
      if (i % 20 === 0) {
        await yieldToBrowser();
        setBatchStatus(`Ficha ${i + 1} de ${blocks.length}...`);
      }
      const fullText = `CONSELHO NACIONAL DE TRÂNSITO ${blocks[i]}`;
      const parsed = parseManualText(fullText);
      if (parsed && parsed.codigo_enquadramento) {
        const docRef = doc(db, 'infractions', parsed.codigo_enquadramento);
        currentBatch.set(docRef, {
          ...parsed,
          status: 'ativo',
          ultima_atualizacao: new Date().toISOString(),
          fonte_legal: parsed.artigo || 'MBFT',
          tags: [parsed.codigo_enquadramento, parsed.artigo || '']
        }, { merge: true });
        countInBatch++;
        totalImported++;
        if (countInBatch >= 450) {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPDF(file);
  };

  const handleClearDatabase = async () => {
    if (!confirm("Isso apagará todas as infrações. Confirmar?")) return;
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
      alert("Base reiniciada.");
    } catch (e) { alert("Erro ao limpar."); } finally { setIsProcessing(false); setBatchStatus(''); }
  };

  const handleRecord = async (inf: Infraction) => {
    if (!user) return;
    setIsRecording(true);
    try {
      const infRef = doc(db, 'infractions', inf.id);
      await updateDoc(infRef, { count_atuacoes: increment(1) });
      alert(`Consulta registrada.`);
      setQuickCode('');
    } catch (e) { alert('Erro.'); } finally { setIsRecording(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col justify-center px-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white italic tracking-tighter">Multas Rápidas</h1>
          <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-2">Plataforma Oficial de Fiscalização</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-4">
          <input type="email" placeholder="E-mail Funcional" className="w-full p-5 bg-slate-50 rounded-3xl outline-none font-bold" id="login-email" />
          <button onClick={() => {
            const email = (document.getElementById('login-email') as HTMLInputElement).value;
            if (!email) return;
            setUser({ id: 'agt-' + Date.now(), name: 'Agente', email, role: email.includes('admin') ? UserRole.GESTOR : UserRole.AGENTE });
          }} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl btn-active">Acessar</button>
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
            <span className="text-[9px] font-bold text-blue-300 uppercase">{user.role}</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-50"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input className="flex-1 px-5 py-4 bg-white/10 rounded-3xl text-white outline-none font-black text-sm uppercase" placeholder="CÓDIGO (EX: 7510)" value={quickCode} onChange={e => setQuickCode(e.target.value)} />
              <button onClick={() => {
                const search = quickCode.replace(/[^0-9]/g, '');
                const found = infractions.find(i => i.codigo_enquadramento.replace(/[^0-9]/g, '') === search);
                if(found) setSelectedInfraction(found); else alert('Código não localizado');
              }} className="bg-orange-500 text-white px-6 rounded-3xl font-black text-xs btn-active shadow-lg">OK</button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center text-blue-400"><Icons.Search /></div>
              <input className="w-full pl-14 pr-6 py-4 bg-blue-900/40 border border-blue-700/50 rounded-3xl text-white outline-none font-bold text-sm" placeholder="O que deseja pesquisar?" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-40 no-scrollbar">
        {selectedInfraction ? (
          <div className="bg-white rounded-[3rem] shadow-2xl p-8 border border-slate-100 mb-10">
            <div className="flex justify-between items-center mb-8">
               <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-5 py-3 rounded-full btn-active"><Icons.ArrowLeft /> Voltar</button>
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <NatureTag natureza={selectedInfraction.natureza} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Art. {selectedInfraction.artigo}</p>
              </div>
              <span className="text-3xl font-black text-blue-600 tracking-tighter">{selectedInfraction.codigo_enquadramento}</span>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              <div className="p-6 bg-slate-900 rounded-[2.5rem]">
                <p className="text-sm text-blue-100 italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="space-y-6">
                <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
                  <h4 className="text-[10px] font-black text-green-700 uppercase mb-4 tracking-widest">Quando Atuar</h4>
                  <ul className="text-xs font-bold text-green-900 space-y-4">
                    {selectedInfraction.quando_atuar?.length ? selectedInfraction.quando_atuar.map((t, i) => <li key={i} className="flex gap-2 leading-relaxed"><span>{i+1}.</span> <span>{t}</span></li>) : <li className="opacity-40 italic">Sem diretrizes disponíveis</li>}
                  </ul>
                </div>

                <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <h4 className="text-[10px] font-black text-red-700 uppercase mb-4 tracking-widest">Quando Não Atuar</h4>
                  <ul className="text-xs font-bold text-red-900 space-y-4">
                    {selectedInfraction.quando_nao_atuar?.length ? selectedInfraction.quando_nao_atuar.map((t, i) => <li key={i} className="flex gap-2 leading-relaxed"><span>{i+1}.</span> <span>{t}</span></li>) : <li className="opacity-40 italic">Sem restrições listadas</li>}
                  </ul>
                </div>

                {selectedInfraction.definicoes_procedimentos && selectedInfraction.definicoes_procedimentos.length > 0 && (
                  <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                    <h4 className="text-[10px] font-black text-blue-700 uppercase mb-4 tracking-widest">Definições e Procedimentos</h4>
                    <ul className="text-xs font-bold text-blue-900 space-y-3">
                      {selectedInfraction.definicoes_procedimentos.map((t, i) => <li key={i} className="flex gap-2 leading-relaxed border-b border-blue-200/30 pb-2 last:border-0 last:pb-0"><span>•</span> <span>{t}</span></li>)}
                    </ul>
                  </div>
                )}

                {selectedInfraction.exemplos_ait && selectedInfraction.exemplos_ait.length > 0 && (
                  <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100">
                    <h4 className="text-[10px] font-black text-orange-700 uppercase mb-4 tracking-widest">Exemplos de Observação (AIT)</h4>
                    <ul className="text-xs font-black text-orange-900 space-y-3 italic">
                      {selectedInfraction.exemplos_ait.map((t, i) => <li key={i} className="flex gap-2 leading-relaxed"><span>•</span> <span>{t}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-[8px] font-black opacity-50 uppercase tracking-widest">Penalidade</h4>
                    <p className="text-xs font-black mt-1">{selectedInfraction.penalidade}</p>
                  </div>
                  <div>
                    <h4 className="text-[8px] font-black opacity-50 uppercase tracking-widest">Pontos</h4>
                    <p className="text-xs font-black mt-1">{selectedInfraction.pontos}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-[8px] font-black opacity-50 uppercase tracking-widest">Medidas Admin</h4>
                  <p className="text-xs font-bold mt-1">
                    {selectedInfraction.medidas_administrativas.length > 0 ? selectedInfraction.medidas_administrativas.join(', ') : 'Nenhuma'}
                  </p>
                </div>
              </div>

              <button onClick={() => handleRecord(selectedInfraction)} disabled={isRecording} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs btn-active shadow-2xl disabled:bg-slate-300">
                REGISTRAR CONSULTA
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'search' && (
              debouncedSearch ? (
                <div className="space-y-4">
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 flex flex-col gap-2 btn-active">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-xs font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight">{inf.titulo_curto}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center text-slate-400">
                    <Icons.Search /><p className="font-black text-xs uppercase mt-4 tracking-widest">Pesquise por palavra ou código</p>
                  </div>
                  {topInfractions.length > 0 && (
                    <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 flex items-center gap-2 tracking-widest"><Icons.Flash /> Mais Consultadas</h3>
                        <div className="space-y-4">
                            {topInfractions.map(inf => (
                                <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full flex justify-between items-center text-left btn-active">
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
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Gestão</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base MBFT Oficial</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleClearDatabase} disabled={isProcessing} className="bg-red-500 text-white px-4 py-4 rounded-[1.8rem] font-black text-xs btn-active shadow-xl"><Icons.Trash /></button>
                    <button onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)} className="bg-blue-600 text-white px-6 py-4 rounded-[1.8rem] font-black text-xs btn-active shadow-xl"><Icons.Plus /></button>
                  </div>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-blue-50 space-y-6">
                    <h3 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2 tracking-widest"><Icons.Upload /> Importar PDF</h3>
                    <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={`w-full py-12 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer transition-all ${isProcessing ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}>
                        {isProcessing ? (
                            <div className="text-center w-full px-10">
                                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-4"><div className="h-full animate-progress rounded-full" style={{ width: `${progress}%` }} /></div>
                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">{batchStatus}</p>
                            </div>
                        ) : (
                            <div className="text-center"><Icons.File /><p className="text-xs font-black uppercase text-slate-400 mt-2">Clique para importar Manual MBFT</p></div>
                        )}
                        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
                    </div>
                  </div>
                )}
                
                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Base Local ({infractions.length} multas)</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                    {infractions.sort((a,b) => a.codigo_enquadramento.localeCompare(b.codigo_enquadramento)).slice(0, 50).map(inf => (
                      <div key={inf.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.8rem] border border-slate-100 group">
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
              <button onClick={() => setActiveTab('search')} className={`p-4 rounded-full transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}><Icons.Search /></button>
              <button onClick={() => setActiveTab('history')} className={`p-4 rounded-full transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}><Icons.History /></button>
              {user.role === UserRole.GESTOR && (
                <button onClick={() => setActiveTab('admin')} className={`p-4 rounded-full transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30' : 'text-slate-500'}`}><Icons.Admin /></button>
              )}
            </nav>
        </div>
      )}
    </div>
  );
}
