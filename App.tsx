
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Infraction, Natureza, AuditLog } from './types';
import { INITIAL_INFRACTIONS } from './mockData';
import { db } from './firebase';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  collection, 
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc
} from 'firebase/firestore';

const Icons = {
  Search: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Star: ({ filled }: { filled?: boolean }) => <svg className={`w-6 h-6 ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  History: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Admin: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002 2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  ArrowLeft: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Flash: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 00-1 1v5H4a1 1 0 00-.832 1.554l7 10a1 1 0 001.664-1.108L10.832 11H17a1 1 0 00.832-1.554l-7-10A1 1 0 0011 3z" /></svg>,
  Check: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
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

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'infractions'), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Infraction[];
        if (data.length > 0) setInfractions(data);
      }, (error) => {
        console.error("Erro ao carregar infrações do Firestore:", error);
      });
      return () => unsub();
    } catch (e) {
      console.error("Firestore falhou ao iniciar listener:", e);
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
      alert('Erro ao registrar. O sistema guardará os dados para sincronizar quando houver internet.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleQuickRecord = () => {
    const code = quickCode.trim();
    if (!code) return;
    const found = infractions.find(i => i.codigo_enquadramento === code);
    if (found) handleRecord(found);
    else alert('Código não encontrado na base de dados.');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-800 flex flex-col justify-center px-8 safe-top safe-bottom">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tighter">Multas Rápidas</h1>
          <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mt-2 opacity-70">MBFT Digital v2</p>
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
              const role = email.includes('admin') ? UserRole.GESTOR : UserRole.AGENTE;
              setUser({ id: 'agt-' + Date.now(), name: 'Agente de Serviço', email, role });
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
      {/* Header com Registro Rápido */}
      <header className="bg-blue-800 text-white px-5 pt-4 pb-6 sticky top-0 z-20 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter">Multas Rápidas</h1>
            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">Atendimento Operacional</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-50 active:opacity-100"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-4 flex items-center text-orange-400"><Icons.Flash /></div>
                <input 
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 outline-none font-black text-sm uppercase"
                  placeholder="CÓDIGO (EX: 52311)"
                  value={quickCode}
                  onChange={e => setQuickCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuickRecord()}
                />
              </div>
              <button 
                onClick={handleQuickRecord} 
                disabled={!quickCode}
                className="bg-orange-500 text-white px-6 rounded-2xl font-black btn-active shadow-lg shadow-orange-500/30 disabled:opacity-50"
              >
                REGISTRAR
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center text-blue-400"><Icons.Search /></div>
              <input 
                className="w-full pl-12 pr-4 py-3 bg-blue-900/40 border border-blue-700/50 rounded-2xl text-white placeholder-blue-300/50 outline-none font-bold text-sm"
                placeholder="Nome da infração ou artigo..."
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
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 border border-slate-100 animate-in slide-in-from-bottom duration-300 mb-10">
            <button onClick={() => setSelectedInfraction(null)} className="mb-6 flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-4 py-2 rounded-full btn-active"><Icons.ArrowLeft /> Voltar</button>
            
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <NatureTag natureza={selectedInfraction.natureza} />
                <p className="text-xs font-black mt-1">Art. {selectedInfraction.artigo}</p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black text-slate-400 uppercase block">Cód. Enquadramento</span>
                <span className="text-2xl font-black text-blue-600">{selectedInfraction.codigo_enquadramento}</span>
              </div>
            </div>

            <div className="space-y-6">
              <section>
                <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipificação Resumida</h2>
                <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              </section>

              <div className="p-4 bg-slate-900 rounded-2xl text-center">
                <h4 className="text-[9px] font-black text-blue-400 uppercase mb-2">Tipificação Completa</h4>
                <p className="text-xs text-blue-100 font-medium italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase mb-2">Quando Autuar</h4>
                  <ul className="text-[10px] font-bold space-y-1">{selectedInfraction.quando_atuar.map((t, idx) => <li key={idx}>• {t}</li>)}</ul>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <h4 className="text-[9px] font-black text-red-800 uppercase mb-2">Não Autuar</h4>
                  <ul className="text-[10px] font-bold text-red-700 space-y-1">{selectedInfraction.quando_nao_atuar.map((t, idx) => <li key={idx}>• {t}</li>)}</ul>
                </div>
              </div>

              <button 
                onClick={() => handleRecord(selectedInfraction)} 
                disabled={isRecording}
                className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest btn-active shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
              >
                <Icons.Check /> {isRecording ? 'Gravando...' : 'Marcar como Aplicada'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'search' && (
              searchQuery ? (
                <div className="space-y-3">
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-5 rounded-3xl shadow-sm border border-slate-100 btn-active flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <NatureTag natureza={inf.natureza} />
                        <span className="text-xs font-black text-blue-600">{inf.codigo_enquadramento}</span>
                      </div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight pr-4">{inf.titulo_curto}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                  <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4"><Icons.Search /></div>
                  <p className="font-black text-xs uppercase tracking-widest">Use a busca acima ou código rápido</p>
                </div>
              )
            )}

            {activeTab === 'admin' && user.role === UserRole.GESTOR && (
              <div className="space-y-6">
                <h2 className="text-3xl font-black tracking-tighter">Relatórios Gestão</h2>
                <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Icons.Admin /> Infrações Mais Registradas</h3>
                  <div className="space-y-5">
                    {topInfractions.length > 0 ? topInfractions.map((inf, idx) => (
                      <div key={inf.id} className="space-y-2">
                        <div className="flex justify-between text-xs font-black">
                          <span className="line-clamp-1">{inf.titulo_curto}</span>
                          <span className="text-blue-600 font-black">{inf.count_atuacoes}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${(inf.count_atuacoes! / topInfractions[0].count_atuacoes!) * 100}%` }}></div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center text-xs text-slate-400 italic">Nenhum registro ainda hoje.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="py-20 text-center opacity-30">
                <Icons.History />
                <p className="font-black text-xs uppercase mt-4">Histórico de atuações em breve</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Nav Inferior */}
      {!selectedInfraction && (
        <nav className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto bg-slate-900/95 backdrop-blur-xl rounded-[3rem] flex justify-around items-center p-4 border border-white/10 shadow-2xl safe-bottom">
          <button onClick={() => setActiveTab('search')} className={`p-4 transition-all ${activeTab === 'search' ? 'text-blue-400 scale-125' : 'text-slate-500'}`}><Icons.Search /></button>
          <button onClick={() => setActiveTab('history')} className={`p-4 transition-all ${activeTab === 'history' ? 'text-blue-400 scale-125' : 'text-slate-500'}`}><Icons.History /></button>
          {user.role === UserRole.GESTOR && (
            <button onClick={() => setActiveTab('admin')} className={`p-4 transition-all ${activeTab === 'admin' ? 'text-blue-400 scale-125' : 'text-slate-500'}`}><Icons.Admin /></button>
          )}
        </nav>
      )}
    </div>
  );
}
