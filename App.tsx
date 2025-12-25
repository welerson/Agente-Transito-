
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
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
  addDoc
} from 'firebase/firestore';

const Icons = {
  Search: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  History: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Admin: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002 2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  ArrowLeft: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Flash: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 00-1 1v5H4a1 1 0 00-.832 1.554l7 10a1 1 0 001.664-1.108L10.832 11H17a1 1 0 00.832-1.554l-7-10A1 1 0 0011 3z" /></svg>,
  Check: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'admin'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firestore Sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'infractions'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Infraction[];
      // If DB is empty, use initial data
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
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return infractions.filter(i => 
      i.codigo_enquadramento.includes(q) || 
      i.titulo_curto.toLowerCase().includes(q) ||
      i.artigo.toLowerCase().includes(q)
    );
  }, [searchQuery, infractions]);

  const topInfractions = useMemo(() => {
    return [...infractions]
      .filter(i => (i.count_atuacoes || 0) > 0)
      .sort((a, b) => (b.count_atuacoes || 0) - (a.count_atuacoes || 0))
      .slice(0, 10);
  }, [infractions]);

  const handleRecord = async (inf: Infraction) => {
    if (!user) return;
    setIsRecording(true);
    try {
      const infRef = doc(db, 'infractions', inf.id);
      await updateDoc(infRef, { count_atuacoes: increment(1) });
      await addDoc(collection(db, 'atuacoes'), {
        infraction_id: inf.id,
        agent_id: user.id,
        agent_name: user.name,
        criado_em: new Date().toISOString()
      });
      alert(`Sucesso! Atuação em '${inf.codigo_enquadramento}' registrada.`);
      setQuickCode('');
    } catch (e) {
      alert('Erro ao registrar.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleDelete = async (inf: Infraction) => {
    if (!confirm(`Deseja realmente excluir a infração ${inf.codigo_enquadramento}?`)) return;
    try {
      await deleteDoc(doc(db, 'infractions', inf.id));
      setSelectedInfraction(null);
      alert('Infração excluída.');
    } catch (e) {
      alert('Erro ao excluir.');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
      reader.onerror = reject;
    });
  };

  const handleImportByGemini = async () => {
    if (!importText.trim() && !selectedFile) {
        alert("Por favor, cole o texto ou suba uma foto da ficha.");
        return;
    }
    setIsParsing(true);
    try {
      // Create a new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      let parts: any[] = [];

      if (selectedFile) {
        const base64Data = await fileToBase64(selectedFile);
        parts.push({ inlineData: { data: base64Data, mimeType: selectedFile.type } });
        parts.push({ text: "Analise esta imagem de uma ficha de fiscalização MBFT. Extraia os dados técnicos e retorne em formato JSON estruturado." });
      } else {
        parts.push({ text: `Extraia os dados técnicos desta ficha: "${importText}"` });
      }

      // Using gemini-3-flash-preview for high speed and accurate OCR parsing
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              artigo: { type: Type.STRING },
              codigo_enquadramento: { type: Type.STRING },
              titulo_curto: { type: Type.STRING },
              descricao: { type: Type.STRING },
              natureza: { type: Type.STRING },
              penalidade: { type: Type.STRING },
              pontos: { type: Type.STRING },
              medidas_administrativas: { type: Type.ARRAY, items: { type: Type.STRING } },
              quando_atuar: { type: Type.ARRAY, items: { type: Type.STRING } },
              quando_nao_atuar: { type: Type.ARRAY, items: { type: Type.STRING } },
              exemplos_ait: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["codigo_enquadramento", "titulo_curto", "natureza"]
          }
        }
      });

      // Extract JSON from response.text securely
      const jsonStr = response.text?.trim() || '{}';
      const data = JSON.parse(jsonStr);
      
      if (!data.codigo_enquadramento) throw new Error("Falha ao extrair código de enquadramento.");

      const newInf: Infraction = {
        ...data,
        id: data.codigo_enquadramento,
        status: 'ativo',
        ultima_atualizacao: new Date().toISOString(),
        fonte_legal: `CTB Art. ${data.artigo || 'N/A'}`
      };

      await setDoc(doc(db, 'infractions', newInf.id), newInf);
      alert('Infração cadastrada com sucesso!');
      setImportText('');
      setSelectedFile(null);
      setIsAdminPanelOpen(false);
    } catch (e) {
      console.error(e);
      alert('Erro no processamento da IA. Verifique sua conexão.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleQuickRecord = () => {
    const code = quickCode.trim();
    if (!code) return;
    const found = infractions.find(i => i.codigo_enquadramento === code);
    if (found) handleRecord(found);
    else alert('Código não encontrado.');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col justify-center px-10 safe-top safe-bottom">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Multas Rápidas</h1>
          <p className="text-blue-300 text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">MBFT DIGITAL v3.0</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Login Funcional</label>
            <input 
              type="email" 
              placeholder="seuemail@admin.com (p/ Gestor)" 
              className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/20 font-bold border border-slate-100 transition-all" 
              id="login-email" 
            />
          </div>
          <button 
            onClick={() => {
              const email = (document.getElementById('login-email') as HTMLInputElement).value;
              if (!email) { alert("Informe seu e-mail"); return; }
              const role = email.toLowerCase().includes('admin') ? UserRole.GESTOR : UserRole.AGENTE;
              setUser({ id: 'agt-' + Date.now(), name: 'Agente em Serviço', email, role });
            }}
            className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest btn-active shadow-xl shadow-blue-600/30 transition-all hover:bg-blue-700"
          >
            Acessar Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden safe-top">
      {/* Header Estilizado */}
      <header className="bg-blue-800 text-white px-6 pt-6 pb-8 sticky top-0 z-20 shadow-2xl rounded-b-[2.5rem]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center font-black text-white">M</div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tighter">Multas Rápidas</h1>
              <span className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">{user.role}</span>
            </div>
          </div>
          <button onClick={() => setUser(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                className="flex-1 px-5 py-4 bg-white/10 border border-white/20 rounded-3xl text-white placeholder-white/40 outline-none font-black text-sm uppercase focus:bg-white/20 transition-all"
                placeholder="CÓDIGO ENQUADRAMENTO"
                value={quickCode}
                onChange={e => setQuickCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleQuickRecord()}
              />
              <button onClick={handleQuickRecord} className="bg-orange-500 text-white px-6 rounded-3xl font-black text-xs btn-active shadow-lg shadow-orange-500/30">REGISTRAR</button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center text-blue-400 group-focus-within:text-white transition-colors"><Icons.Search /></div>
              <input 
                className="w-full pl-14 pr-6 py-4 bg-blue-900/40 border border-blue-700/50 rounded-3xl text-white placeholder-blue-300/40 outline-none font-bold text-sm focus:ring-4 focus:ring-blue-400/10 transition-all"
                placeholder="Buscar por nome, artigo ou tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar">
        {selectedInfraction ? (
          <div className="bg-white rounded-[3rem] shadow-2xl p-8 border border-slate-100 animate-in slide-in-from-bottom duration-300 mb-10">
            <div className="flex justify-between items-center mb-8">
              <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-5 py-3 rounded-full btn-active transition-all"><Icons.ArrowLeft /> Voltar</button>
              {user.role === UserRole.GESTOR && (
                <button onClick={() => handleDelete(selectedInfraction)} className="text-red-500 p-3 bg-red-50 rounded-2xl btn-active hover:bg-red-100 transition-all"><Icons.Trash /></button>
              )}
            </div>
            
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1">
                <NatureTag natureza={selectedInfraction.natureza} />
                <p className="text-sm font-black text-slate-900">Art. {selectedInfraction.artigo}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-300 uppercase block tracking-widest">Enquadramento</span>
                <span className="text-3xl font-black text-blue-600">{selectedInfraction.codigo_enquadramento}</span>
              </div>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="text-2xl font-black text-slate-900 leading-tight mb-2">{selectedInfraction.titulo_curto}</h3>
                <div className="p-5 bg-slate-900 rounded-[2rem] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Icons.Flash /></div>
                  <h4 className="text-[10px] font-black text-blue-400 uppercase mb-3 tracking-widest">Descrição Completa</h4>
                  <p className="text-sm text-blue-100 font-medium italic leading-relaxed">"{selectedInfraction.descricao}"</p>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
                  <h4 className="text-[10px] font-black text-green-700 uppercase mb-4 tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Quando Atuar</h4>
                  <ul className="text-xs font-bold text-green-900 space-y-3">{selectedInfraction.quando_atuar.map((t, idx) => <li key={idx} className="flex gap-2 leading-snug"><span className="text-green-400">•</span> {t}</li>)}</ul>
                </div>
                <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <h4 className="text-[10px] font-black text-red-700 uppercase mb-4 tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Não Atuar</h4>
                  <ul className="text-xs font-bold text-red-900 space-y-3">{selectedInfraction.quando_nao_atuar.map((t, idx) => <li key={idx} className="flex gap-2 leading-snug"><span className="text-red-400">•</span> {t}</li>)}</ul>
                </div>
              </div>

              {selectedInfraction.exemplos_ait && selectedInfraction.exemplos_ait.length > 0 && (
                <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                  <h4 className="text-[10px] font-black text-blue-700 uppercase mb-4 tracking-widest">Exemplos de Observações</h4>
                  <ul className="text-xs font-bold text-blue-900 space-y-3">{selectedInfraction.exemplos_ait.map((t, idx) => <li key={idx} className="italic leading-relaxed">"{t}"</li>)}</ul>
                </div>
              )}

              <button 
                onClick={() => handleRecord(selectedInfraction)} 
                disabled={isRecording}
                className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs btn-active shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-4 transition-all hover:bg-blue-700 disabled:bg-slate-300"
              >
                <Icons.Check /> {isRecording ? 'PROCESSANDO...' : 'REGISTRAR ATUAÇÃO'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'search' && (
              searchQuery ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resultados Encontrados ({filteredInfractions.length})</p>
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 btn-active flex flex-col gap-3 transition-all hover:shadow-xl">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-sm font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-black text-slate-800 text-base leading-tight pr-4">{inf.titulo_curto}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="flex flex-col items-center justify-center py-16 opacity-20 text-center scale-150">
                    <Icons.Search />
                    <p className="font-black text-[8px] uppercase tracking-[0.3em] mt-3 ml-1">Aguardando Termo</p>
                  </div>
                  {topInfractions.length > 0 && (
                    <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Icons.Flash /> Infrações Frequentes</h3>
                        <div className="space-y-5">
                            {topInfractions.map(inf => (
                                <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full flex justify-between items-center py-1 group text-left btn-active">
                                    <span className="text-sm font-black text-slate-700 truncate mr-6 group-hover:text-blue-600 transition-colors">{inf.titulo_curto}</span>
                                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl shrink-0">{inf.count_atuacoes}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                  )}
                </div>
              )
            )}

            {activeTab === 'admin' && user.role === UserRole.GESTOR && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900">Gestão</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base de Dados MBFT</p>
                  </div>
                  <button 
                    onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
                    className="flex items-center gap-3 bg-blue-600 text-white px-6 py-4 rounded-[1.8rem] font-black text-xs uppercase shadow-xl shadow-blue-600/30 btn-active transition-all"
                  >
                    <Icons.Plus /> {isAdminPanelOpen ? 'Fechar' : 'Nova Multa'}
                  </button>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-blue-50 space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="space-y-2">
                        <h3 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2"><Icons.Upload /> Importação Inteligente (OCR)</h3>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Coloque a foto da ficha do manual ou cole o texto do MBFT para processar com Inteligência Artificial.</p>
                    </div>
                    
                    <div className="space-y-5">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full py-10 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer transition-all ${selectedFile ? 'border-green-400 bg-green-50 shadow-inner' : 'border-slate-100 hover:border-blue-300 bg-slate-50'}`}
                        >
                            {selectedFile ? (
                                <div className="text-center p-4">
                                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg"><Icons.Check /></div>
                                    <p className="text-xs font-black text-green-700 truncate max-w-[200px]">{selectedFile.name}</p>
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-[10px] font-black text-red-500 uppercase mt-3 hover:underline">Remover Arquivo</button>
                                </div>
                            ) : (
                                <div className="text-center text-slate-300 p-4">
                                    <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4"><Icons.File /></div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Subir Foto da Ficha</p>
                                    <p className="text-[9px] font-bold mt-1">(Suporta JPEG, PNG)</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                        </div>

                        <div className="relative">
                            <div className="absolute -top-3 left-6 px-3 bg-white text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Ou Cole o Texto</div>
                            <textarea 
                              className="w-full h-32 p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all no-scrollbar"
                              placeholder="Tipificação Resumida... Código... Amparo Legal..."
                              value={importText}
                              onChange={(e) => setImportText(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                      onClick={handleImportByGemini}
                      disabled={isParsing || (!importText.trim() && !selectedFile)}
                      className={`w-full py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-4 btn-active shadow-2xl transition-all ${isParsing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white shadow-slate-900/40 hover:bg-black'}`}
                    >
                      {isParsing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                          ANALISANDO FICHA...
                        </>
                      ) : (
                        <><Icons.Upload /> PROCESSAR E SALVAR</>
                      )}
                    </button>
                  </div>
                )}

                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-[0.2em]">Base de Infrações ({infractions.length})</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                    {infractions.sort((a,b) => a.codigo_enquadramento.localeCompare(b.codigo_enquadramento)).map(inf => (
                      <div key={inf.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.8rem] border border-slate-100 hover:bg-white hover:shadow-lg transition-all group">
                        <div className="flex-1 truncate mr-4">
                          <p className="text-[11px] font-black text-blue-600 mb-1">{inf.codigo_enquadramento}</p>
                          <p className="text-sm font-bold text-slate-800 truncate">{inf.titulo_curto}</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setSelectedInfraction(inf)} className="p-3 text-blue-500 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Icons.Search /></button>
                           <button onClick={() => handleDelete(inf)} className="p-3 text-red-300 hover:text-red-600 transition-colors btn-active">
                             <Icons.Trash />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 opacity-30 text-slate-500"><Icons.History /></div>
                <p className="font-black text-xs uppercase text-slate-300 tracking-[0.2em]">Sem Atividade Recente</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navigation Moderna */}
      {!selectedInfraction && (
        <div className="fixed bottom-8 left-0 right-0 px-8 z-30">
            <nav className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-2xl rounded-[3.5rem] flex justify-around items-center p-3 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] safe-bottom">
              <button 
                onClick={() => setActiveTab('search')} 
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-full transition-all duration-300 ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icons.Search />
              </button>
              <button 
                onClick={() => setActiveTab('history')} 
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-full transition-all duration-300 ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icons.History />
              </button>
              {user.role === UserRole.GESTOR && (
                <button 
                  onClick={() => setActiveTab('admin')} 
                  className={`flex-1 flex flex-col items-center justify-center p-4 rounded-full transition-all duration-300 ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Icons.Admin />
                </button>
              )}
            </nav>
        </div>
      )}
    </div>
  );
}
