
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, Infraction, Natureza } from './types';
import { INITIAL_INFRACTIONS } from './mockData';
import { db } from './firebase';
// Ensure correct imports from @google/genai
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
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
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border border-current/10 ${colors[natureza]}`}>{natureza}</span>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'history' | 'admin'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [infractions, setInfractions] = useState<Infraction[]>(INITIAL_INFRACTIONS);
  const [isRecording, setIsRecording] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'infractions'), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Infraction[];
        if (data.length > 0) setInfractions(data);
      }, (error) => {
        console.error("Erro Firestore:", error);
      });
      return () => unsub();
    } catch (e) {
      console.error("Firestore falhou:", e);
    }
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
      console.error(e);
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
      alert('Infração excluída com sucesso.');
    } catch (e) {
      alert('Erro ao excluir.');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (base64) resolve(base64);
        else reject('Falha ao ler arquivo');
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImportByGemini = async () => {
    if (!importText.trim() && !selectedFile) {
        alert("Por favor, cole o texto ou selecione uma imagem da ficha.");
        return;
    }
    setIsParsing(true);
    try {
      // Initialize ai with named parameter apiKey, no extra spaces as per guidelines.
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      let parts: any[] = [];

      if (selectedFile) {
        const base64Data = await fileToBase64(selectedFile);
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: selectedFile.type
          }
        });
        parts.push({ text: `Analise esta imagem de ficha de infração (MBFT/PDF). Extraia os dados técnicos e retorne no formato JSON conforme o schema definido.` });
      } else {
        parts.push({ text: `Extraia os dados técnicos desta ficha de infração de trânsito (MBFT/CTB). Retorne no formato JSON.\nTexto: "${importText}"` });
      }

      // Using gemini-3-pro-preview for complex reasoning and technical document extraction tasks.
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
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
              natureza: { type: Type.STRING, description: "Deve ser 'Leve', 'Média', 'Grave' ou 'Gravíssima'" },
              penalidade: { type: Type.STRING },
              pontos: { type: Type.INTEGER },
              medidas_administrativas: { type: Type.ARRAY, items: { type: Type.STRING } },
              quando_atuar: { type: Type.ARRAY, items: { type: Type.STRING } },
              quando_nao_atuar: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["codigo_enquadramento", "titulo_curto", "natureza"]
          }
        }
      });

      // Directly accessing the text property from GenerateContentResponse.
      const responseBody = response.text || '';
      if (!responseBody) throw new Error("A IA retornou uma resposta vazia.");
      
      const parsed = JSON.parse(responseBody);
      const newInf: Infraction = {
        ...parsed,
        id: parsed.codigo_enquadramento,
        status: 'ativo',
        ultima_atualizacao: new Date().toISOString(),
        fonte_legal: `CTB Art. ${parsed.artigo || 'N/A'}`
      };

      await setDoc(doc(db, 'infractions', newInf.id), newInf);
      alert('Cadastro realizado com sucesso via IA!');
      setImportText('');
      setSelectedFile(null);
      setIsAdminPanelOpen(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao processar com IA. Tente novamente ou cole o texto manualmente.');
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
      <div className="min-h-screen bg-blue-800 flex flex-col justify-center px-8 safe-top safe-bottom">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tighter">Multas Rápidas</h1>
          <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-70">ACESSO OPERACIONAL</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-4">
          <input 
            type="email" 
            placeholder="E-mail funcional" 
            className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium border border-slate-200" 
            id="login-email" 
          />
          <button 
            onClick={() => {
              const email = (document.getElementById('login-email') as HTMLInputElement).value;
              if (!email) { alert("Informe seu e-mail"); return; }
              const role = email.toLowerCase().includes('admin') ? UserRole.GESTOR : UserRole.AGENTE;
              setUser({ id: 'agt-' + Date.now(), name: 'Agente Silva', email, role });
            }}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest btn-active shadow-lg shadow-blue-600/20"
          >
            Acessar Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden safe-top">
      {/* Header */}
      <header className="bg-blue-800 text-white px-5 pt-4 pb-6 sticky top-0 z-20 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter">Multas Rápidas</h1>
            <span className="text-[8px] font-bold text-blue-300 uppercase tracking-widest">{user.role} - ONLINE</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-50"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input 
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 outline-none font-black text-sm uppercase"
                placeholder="CÓDIGO (EX: 52311)"
                value={quickCode}
                onChange={e => setQuickCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleQuickRecord()}
              />
              <button onClick={handleQuickRecord} className="bg-orange-500 text-white px-4 rounded-2xl font-black text-[10px] btn-active shadow-lg shadow-orange-500/30">OK</button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center text-blue-400"><Icons.Search /></div>
              <input 
                className="w-full pl-12 pr-4 py-3 bg-blue-900/40 border border-blue-700/50 rounded-2xl text-white placeholder-blue-300/50 outline-none font-bold text-sm"
                placeholder="Pesquisar infração..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 no-scrollbar">
        {selectedInfraction ? (
          <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-slate-100 animate-in slide-in-from-bottom duration-300 mb-10">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-4 py-2 rounded-full btn-active"><Icons.ArrowLeft /> Voltar</button>
              {user.role === UserRole.GESTOR && (
                <button onClick={() => handleDelete(selectedInfraction)} className="text-red-600 p-2 bg-red-50 rounded-full btn-active"><Icons.Trash /></button>
              )}
            </div>
            
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <NatureTag natureza={selectedInfraction.natureza} />
                <p className="text-xs font-black mt-1">Art. {selectedInfraction.artigo}</p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black text-slate-400 uppercase block">Código</span>
                <span className="text-xl font-black text-blue-600">{selectedInfraction.codigo_enquadramento}</span>
              </div>
            </div>

            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              </section>

              <div className="p-4 bg-slate-900 rounded-2xl">
                <h4 className="text-[8px] font-black text-blue-400 uppercase mb-2">Tipificação Completa</h4>
                <p className="text-[11px] text-blue-100 font-medium italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase mb-2">Quando Atuar</h4>
                  <ul className="text-[10px] font-bold space-y-1">{selectedInfraction.quando_atuar.map((t, idx) => <li key={idx}>• {t}</li>)}</ul>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <h4 className="text-[9px] font-black text-red-800 uppercase mb-2">Não Atuar</h4>
                  <ul className="text-[10px] font-bold text-red-700 space-y-1">{selectedInfraction.quando_nao_atuar.map((t, idx) => <li key={idx}>• {t}</li>)}</ul>
                </div>
              </div>

              <button 
                onClick={() => handleRecord(selectedInfraction)} 
                disabled={isRecording}
                className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest btn-active shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
              >
                <Icons.Check /> {isRecording ? 'Salvando...' : 'Registrar Atuação'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'search' && (
              searchQuery ? (
                <div className="space-y-2">
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-4 rounded-2xl shadow-sm border border-slate-100 btn-active flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-[10px] font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-xs leading-tight line-clamp-2">{inf.titulo_curto}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center">
                    <Icons.Search />
                    <p className="font-black text-[10px] uppercase tracking-widest mt-2">Pesquisa rápida habilitada</p>
                  </div>
                  {topInfractions.length > 0 && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Infrações Frequentes</h3>
                        <div className="space-y-3">
                            {topInfractions.map(inf => (
                                <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full flex justify-between items-center py-2 border-b border-slate-50 text-left btn-active">
                                    <span className="text-[11px] font-bold text-slate-700 truncate mr-4">{inf.titulo_curto}</span>
                                    <span className="text-[10px] font-black text-blue-600 shrink-0">{inf.count_atuacoes}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                  )}
                </div>
              )
            )}

            {activeTab === 'admin' && user.role === UserRole.GESTOR && (
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-black tracking-tighter">Gestão</h2>
                  <button 
                    onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-full font-black text-[10px] uppercase shadow-lg shadow-blue-600/30 btn-active"
                  >
                    <Icons.Plus /> Novo Cadastro
                  </button>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-[2rem] p-6 shadow-2xl border-2 border-blue-50 space-y-4 animate-in zoom-in-95 duration-200">
                    <h3 className="text-xs font-black uppercase text-slate-500">Importação Inteligente (IA)</h3>
                    
                    <div className="space-y-4">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedFile ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-blue-400 bg-slate-50'}`}
                        >
                            {selectedFile ? (
                                <div className="text-center">
                                    <Icons.Check />
                                    <p className="text-[10px] font-bold text-green-700 mt-1">{selectedFile.name}</p>
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-[8px] text-red-500 underline mt-1">Remover</button>
                                </div>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <Icons.File />
                                    <p className="text-[10px] font-bold mt-2 uppercase tracking-tighter">Subir Imagem da Ficha/PDF</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                        </div>

                        <div className="text-center text-[10px] font-bold text-slate-400 uppercase">ou cole o texto abaixo</div>

                        <textarea 
                          className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Cole aqui o texto da infração..."
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                        />
                    </div>

                    <button 
                      onClick={handleImportByGemini}
                      disabled={isParsing || (!importText.trim() && !selectedFile)}
                      className={`w-full py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 btn-active shadow-xl transition-all ${isParsing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white shadow-slate-900/20'}`}
                    >
                      {isParsing ? 'Processando com IA...' : <><Icons.Upload /> Processar e Salvar</>}
                    </button>
                  </div>
                )}

                <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Base de Dados ({infractions.length})</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                    {infractions.map(inf => (
                      <div key={inf.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex-1 truncate mr-4">
                          <p className="text-[10px] font-black text-blue-600">{inf.codigo_enquadramento}</p>
                          <p className="text-[11px] font-bold text-slate-800 truncate">{inf.titulo_curto}</p>
                        </div>
                        <button onClick={() => handleDelete(inf)} className="p-2 text-red-400 hover:text-red-600 transition-colors btn-active">
                          <Icons.Trash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="py-20 text-center opacity-30">
                <Icons.History />
                <p className="font-black text-[10px] uppercase mt-4">Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navigation */}
      {!selectedInfraction && (
        <nav className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-xl rounded-[3rem] flex justify-around items-center p-2 border border-white/10 shadow-2xl safe-bottom">
          <button onClick={() => setActiveTab('search')} className={`p-4 transition-all ${activeTab === 'search' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}><Icons.Search /></button>
          <button onClick={() => setActiveTab('history')} className={`p-4 transition-all ${activeTab === 'history' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}><Icons.History /></button>
          {user.role === UserRole.GESTOR && (
            <button onClick={() => setActiveTab('admin')} className={`p-4 transition-all ${activeTab === 'admin' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}><Icons.Admin /></button>
          )}
        </nav>
      )}
    </div>
  );
}
