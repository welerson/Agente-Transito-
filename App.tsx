
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Infraction, Natureza, AuditLog, InfractionRecord } from './types';
import { INITIAL_INFRACTIONS } from './mockData';
import { db } from './firebase';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment, 
  collection, 
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  deleteDoc
} from 'firebase/firestore';

// --- Icons ---
const Icons = {
  Search: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Star: ({ filled }: { filled?: boolean }) => <svg className={`w-6 h-6 ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  History: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Admin: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  ArrowLeft: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 3z" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
  Flash: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 00-1 1v5H4a1 1 0 00-.832 1.554l7 10a1 1 0 001.664-1.108L10.832 11H17a1 1 0 00.832-1.554l-7-10A1 1 0 0011 3z" /></svg>,
};

// --- Helper Components ---
const NatureTag: React.FC<{ natureza: Natureza }> = ({ natureza }) => {
  const colors = {
    [Natureza.LEVE]: 'bg-blue-100 text-blue-700 border-blue-200',
    [Natureza.MEDIA]: 'bg-green-100 text-green-700 border-green-200',
    [Natureza.GRAVE]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    [Natureza.GRAVISSIMA]: 'bg-red-100 text-red-700 border-red-200',
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${colors[natureza]}`}>{natureza}</span>;
};

// --- Login View ---
const LoginView: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = email.toLowerCase().includes('admin') ? UserRole.GESTOR : UserRole.AGENTE;
    onLogin({ id: Date.now().toString(), name: role === UserRole.GESTOR ? 'Gestor Master' : 'Agente Operacional', email, role });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 bg-blue-800 safe-top safe-bottom">
      <div className="text-center mb-10 animate-in fade-in slide-in-from-top duration-700">
        <div className="bg-white/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl backdrop-blur-md">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter mb-2">Multas Rápidas</h1>
        <p className="text-blue-200 font-bold uppercase text-[10px] tracking-widest leading-none">Acesso Restrito - Agentes</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-5">
        <input type="email" required placeholder="E-mail" className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" required placeholder="Senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg btn-active uppercase tracking-wider">Acessar Aplicativo</button>
      </form>
    </div>
  );
};

// --- App Main ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'favorites' | 'history' | 'admin'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [infractions, setInfractions] = useState<Infraction[]>(INITIAL_INFRACTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'infractions'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Infraction[];
      if (data.length > 0) setInfractions(data);
    });
    const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('criado_em', 'desc'), limit(20)), (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuditLog[]);
    });
    return () => { unsub(); unsubLogs(); };
  }, []);

  const filteredInfractions = useMemo(() => {
    if (!searchQuery) return [];
    const queryTerms = searchQuery.toLowerCase().split(' ').filter(t => t.length > 1);
    return infractions.filter(i => {
      const searchableText = [i.codigo_enquadramento, i.titulo_curto, i.descricao, i.artigo, ...(i.tags || [])].join(' ').toLowerCase();
      return queryTerms.every(term => searchableText.includes(term));
    });
  }, [searchQuery, infractions]);

  const topInfractions = useMemo(() => {
    return [...infractions].filter(i => (i.count_atuacoes || 0) > 0).sort((a, b) => (b.count_atuacoes || 0) - (a.count_atuacoes || 0)).slice(0, 10);
  }, [infractions]);

  const handleSelect = (inf: Infraction) => {
    setSelectedInfraction(inf);
  };

  const recordAtuacao = async (inf: Infraction) => {
    if (!user) return;
    try {
      const infRef = doc(db, 'infractions', inf.id);
      await updateDoc(infRef, { count_atuacoes: increment(1) });
      await addDoc(collection(db, 'atuacoes'), {
        infraction_id: inf.id,
        infraction_title: inf.titulo_curto,
        agent_id: user.id,
        agent_name: user.name,
        criado_em: new Date().toISOString()
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleQuickRecord = async () => {
    if (!quickCode.trim() || !user) return;
    const found = infractions.find(i => i.codigo_enquadramento === quickCode.trim());
    if (!found) {
      alert('Código não encontrado na base de dados.');
      return;
    }
    setIsRecording(true);
    const success = await recordAtuacao(found);
    if (success) {
      setQuickCode('');
      alert(`Atuação registrada: ${found.codigo_enquadramento}`);
    } else {
      alert('Erro ao registrar.');
    }
    setIsRecording(false);
  };

  const handleAiImport = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise este texto da Ficha de Fiscalização do MBFT e extraia em JSON respeitando rigorosamente a estrutura da ficha (Tipificação Resumida, Código, Artigo, Quando Autuar, Quando Não Autuar, Definições, Exemplos AIT): ${aiInput}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              artigo: { type: Type.STRING },
              codigo_enquadramento: { type: Type.STRING },
              titulo_curto: { type: Type.STRING },
              descricao: { type: Type.STRING },
              natureza: { type: Type.STRING },
              penalidade: { type: Type.STRING },
              pontos: { type: Type.INTEGER },
              medidas_administrativas: { type: Type.ARRAY, items: { type: Type.STRING } },
              quando_atuar: { type: Type.ARRAY, items: { type: Type.STRING } },
              quando_nao_atuar: { type: Type.ARRAY, items: { type: Type.STRING } },
              definicoes_procedimentos: { type: Type.ARRAY, items: { type: Type.STRING } },
              exemplos_ait: { type: Type.ARRAY, items: { type: Type.STRING } },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['artigo', 'codigo_enquadramento', 'titulo_curto', 'natureza']
          }
        }
      });
      const newInf = JSON.parse(response.text) as Infraction;
      newInf.id = newInf.codigo_enquadramento || Date.now().toString();
      newInf.status = 'ativo';
      newInf.ultima_atualizacao = new Date().toISOString();
      newInf.count_atuacoes = 0;
      await setDoc(doc(db, 'infractions', newInf.id), newInf);
      await addDoc(collection(db, 'audit_logs'), {
        admin_name: user?.name,
        acao: 'CRIAR',
        detalhes: `Importou ficha: ${newInf.titulo_curto}`,
        criado_em: new Date().toISOString()
      });
      setAiInput('');
      setIsAiImportOpen(false);
      alert('Ficha cadastrada com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao processar.');
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!user) return <LoginView onLogin={setUser} />;

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden shadow-2xl border-x border-slate-200 safe-top">
      {/* Header Fixo */}
      <header className="bg-blue-800 text-white px-5 pt-4 pb-6 sticky top-0 z-20 shadow-lg">
        <div className="flex justify-between items-center mb-5">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter leading-none">Multas Rápidas</h1>
            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-widest mt-1">Sincronizado via Nuvem</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-70 hover:opacity-100 transition-opacity"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-4">
            {/* Registro Rápido por Código (Otimizado para o Agente que já sabe o código) */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-orange-400"><Icons.Flash /></div>
                <input 
                  className="w-full pl-12 pr-4 py-3 bg-orange-500/10 border border-orange-400/30 rounded-2xl text-white placeholder-orange-200 focus:ring-4 focus:ring-orange-400/20 outline-none transition-all font-black uppercase text-sm"
                  placeholder="CÓDIGO RÁPIDO (EX: 52311)"
                  value={quickCode}
                  onChange={e => setQuickCode(e.target.value.replace(/[^0-9-]/g, ''))}
                />
              </div>
              <button 
                onClick={handleQuickRecord}
                disabled={isRecording || !quickCode}
                className="bg-orange-500 text-white px-6 rounded-2xl font-black text-xs uppercase shadow-lg shadow-orange-500/20 btn-active disabled:opacity-50"
              >
                {isRecording ? '...' : 'OK'}
              </button>
            </div>

            {/* Busca por Texto */}
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-blue-400"><Icons.Search /></div>
              <input 
                className="w-full pl-12 pr-4 py-3 bg-blue-900/40 border border-blue-700/50 rounded-2xl text-white placeholder-blue-300 focus:ring-4 focus:ring-blue-400/20 outline-none transition-all font-bold text-sm"
                placeholder="Pesquisar infração..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto pb-32 px-4 pt-4 no-scrollbar">
        {selectedInfraction ? (
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 animate-in slide-in-from-bottom duration-300 border border-slate-100 mb-20">
            <button onClick={() => setSelectedInfraction(null)} className="mb-6 flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-4 py-2 rounded-full w-fit btn-active"><Icons.ArrowLeft /> Voltar</button>
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div className="flex flex-col gap-1">
                <NatureTag natureza={selectedInfraction.natureza} />
                <span className="text-xs font-black text-slate-700">Art. {selectedInfraction.artigo}</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Enquadramento</span>
                <span className="text-xl font-black text-blue-600 tracking-tight">{selectedInfraction.codigo_enquadramento}</span>
              </div>
            </div>

            <div className="space-y-6">
              <section>
                <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipificação Resumida</h2>
                <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              </section>

              <div className="p-4 bg-slate-900 rounded-3xl shadow-lg border border-slate-800">
                <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 text-center">Tipificação Completa</h4>
                <p className="text-xs text-blue-100 leading-relaxed font-medium italic text-center">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <section className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">Autuar</h3>
                  <ul className="space-y-2">
                    {selectedInfraction.quando_atuar?.map((it, idx) => (
                      <li key={idx} className="text-[11px] text-slate-700 font-medium leading-tight">• {it}</li>
                    ))}
                  </ul>
                </section>
                <section className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <h3 className="text-[9px] font-black text-red-800 uppercase tracking-widest mb-2 border-b border-red-200 pb-1">Não Autuar</h3>
                  <ul className="space-y-2">
                    {selectedInfraction.quando_nao_atuar?.map((it, idx) => (
                      <li key={idx} className="text-[11px] text-red-700 font-bold leading-tight">• {it}</li>
                    ))}
                  </ul>
                </section>
              </div>

              {selectedInfraction.exemplos_ait && (
                <section className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Observações AIT</h3>
                  <div className="space-y-2">
                    {selectedInfraction.exemplos_ait.map((it, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-800 italic">"{it}"</div>
                    ))}
                  </div>
                </section>
              )}

              <div className="pt-6 flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setIsRecording(true);
                    recordAtuacao(selectedInfraction).then(success => {
                      if (success) alert('Atuação computada!');
                      setIsRecording(false);
                    });
                  }}
                  disabled={isRecording}
                  className="w-full h-16 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest btn-active shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
                >
                  <Icons.Check /> {isRecording ? 'Gravando...' : 'Marcar como Aplicada'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'search' && (
              searchQuery ? (
                <div className="animate-in fade-in duration-300">
                  <div className="space-y-3">
                    {filteredInfractions.map(inf => (
                      <button key={inf.id} onClick={() => handleSelect(inf)} className="w-full text-left bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-blue-300 btn-active flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <NatureTag natureza={inf.natureza} />
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{inf.codigo_enquadramento}</span>
                        </div>
                        <h3 className="font-black text-slate-800 text-sm leading-tight pr-4">{inf.titulo_curto}</h3>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-200 mb-6 border border-blue-100">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter mb-2 italic">Suporte à Fiscalização</h3>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-wider">Selecione uma multa ou informe o código para registro rápido no sistema de estatística.</p>
                </div>
              )
            )}
            
            {activeTab === 'admin' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Dados</h2>
                  <button onClick={() => setIsAiImportOpen(true)} className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex items-center gap-2 px-5 font-black text-[10px] uppercase transition-all active:scale-95">
                    <Icons.Sparkles /> Nova Ficha
                  </button>
                </div>

                {/* Top Atuações para Relatório */}
                <section className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">Tendências de Fiscalização</h3>
                  <div className="space-y-4">
                    {topInfractions.map((inf, idx) => (
                      <div key={inf.id} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500">{idx+1}</div>
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-black text-slate-800 line-clamp-1">{inf.titulo_curto}</span>
                            <span className="text-xs font-black text-blue-600 ml-2">{inf.count_atuacoes}</span>
                          </div>
                          <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(inf.count_atuacoes! / topInfractions[0].count_atuacoes!) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="bg-blue-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Administração</p>
                  <p className="text-xl font-black mb-6">Controle da Base de Dados</p>
                  <div className="flex justify-between items-end border-t border-white/10 pt-6">
                    <div>
                      <p className="text-[10px] text-blue-300 font-black uppercase mb-1">Fichas no Banco</p>
                      <p className="text-4xl font-black">{infractions.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navegação Inferior (PWA Style) */}
      {!selectedInfraction && (
        <nav className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto bg-slate-900/90 backdrop-blur-xl shadow-2xl rounded-[3rem] flex justify-between items-center px-6 py-4 safe-bottom z-30 border border-white/10">
          <button onClick={() => setActiveTab('search')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'search' ? 'text-blue-400' : 'text-slate-500'}`}>
             <Icons.Search />
             <span className="text-[8px] font-black uppercase tracking-widest">Início</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-blue-400' : 'text-slate-500'}`}>
             <Icons.History />
             <span className="text-[8px] font-black uppercase tracking-widest">Histórico</span>
          </button>
          {user.role === UserRole.GESTOR && (
            <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'admin' ? 'text-blue-400' : 'text-slate-500'}`}>
               <Icons.Admin />
               <span className="text-[8px] font-black uppercase tracking-widest">Relatório</span>
            </button>
          )}
        </nav>
      )}

      {/* Modal IA */}
      {isAiImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-6 relative">
            <button onClick={() => setIsAiImportOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><Icons.Close /></button>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3"><Icons.Sparkles /> Importar MBFT</h3>
            <textarea rows={10} className="w-full bg-slate-50 border border-slate-200 p-5 rounded-3xl text-sm font-medium focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="Cole o texto da ficha aqui..." value={aiInput} onChange={e => setAiInput(e.target.value)} />
            <button disabled={isAiLoading} onClick={handleAiImport} className="w-full h-16 bg-blue-600 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest btn-active shadow-xl flex items-center justify-center gap-3">
              {isAiLoading ? 'Processando...' : 'Cadastrar na Nuvem'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
