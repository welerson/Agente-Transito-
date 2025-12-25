
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
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firestore Sync
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
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
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

  // PARSER SISTÊMICO ROBUSTO (PROCESSAMENTO LOCAL VIA REGEX)
  const parseManualText = (text: string): Partial<Infraction> | null => {
    try {
      const clean = (str: string) => str ? str.trim().replace(/\s+/g, ' ') : '';
      
      const fields = {
        titulo_curto: /Tipificação Resumida:\s*([\s\S]*?)(?=Código do Enquadramento:|Amparo Legal:|Tipificação do Enquadramento:|$)/i,
        codigo_enquadramento: /Código do Enquadramento:\s*([\d-]+)/i,
        artigo: /Amparo Legal:\s*([\s\S]*?)(?=Tipificação do Enquadramento:|Gravidade:|$)/i,
        descricao: /Tipificação do Enquadramento:\s*([\s\S]*?)(?=Gravidade:|Penalidade:|$)/i,
        penalidade: /Penalidade:\s*([\s\S]*?)(?=Medida Administrativa:|Pode Configurar:|$)/i,
        gravidade: /Gravidade:\s*([\s\S]*?)(?=Penalidade:|Infrator:|$)/i
      };

      const result: any = {};
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

      // Extração de Bullets para Atuação
      const sections = text.split(/Quando AUTUAR|Quando NÃO Autuar|Definições e Procedimentos|Exemplos do Campo/i);
      if (sections.length >= 3) {
        result.quando_atuar = sections[1].split('\n').map(s => s.trim()).filter(s => s.length > 5).map(s => s.replace(/^\d+\.\s*/, ''));
        result.quando_nao_atuar = sections[2].split('\n').map(s => s.trim()).filter(s => s.length > 5).map(s => s.replace(/^\d+\.\s*/, ''));
      }

      // Validação Mínima
      if (!result.codigo_enquadramento || (!result.titulo_curto && !result.descricao)) return null;
      
      // Se não achou título curto mas achou descrição, usa o início da descrição
      if (!result.titulo_curto && result.descricao) {
        result.titulo_curto = result.descricao.substring(0, 60) + '...';
      }

      return result;
    } catch (e) {
      return null;
    }
  };

  const handleImportSystemic = async () => {
    if (!importText.trim()) {
      alert("Por favor, cole o texto do manual na caixa abaixo.");
      return;
    }
    
    setIsProcessing(true);
    const parsed = parseManualText(importText);
    
    if (parsed && parsed.codigo_enquadramento) {
      const newInf: Infraction = {
        id: parsed.codigo_enquadramento!,
        artigo: parsed.artigo || 'N/A',
        codigo_enquadramento: parsed.codigo_enquadramento!,
        titulo_curto: parsed.titulo_curto || 'Infração sem Resumo',
        descricao: parsed.descricao || '',
        natureza: parsed.natureza || Natureza.MEDIA,
        penalidade: parsed.penalidade || '',
        pontos: parsed.natureza === Natureza.GRAVISSIMA ? 7 : parsed.natureza === Natureza.GRAVE ? 5 : 4,
        medidas_administrativas: [],
        quando_atuar: parsed.quando_atuar || [],
        quando_nao_atuar: parsed.quando_nao_atuar || [],
        tags: [parsed.codigo_enquadramento!],
        fonte_legal: 'Manual MBFT',
        ultima_atualizacao: new Date().toISOString(),
        status: 'ativo'
      };

      try {
        await setDoc(doc(db, 'infractions', newInf.id), newInf);
        alert(`Infração ${newInf.codigo_enquadramento} cadastrada com sucesso!`);
        setImportText('');
        setIsAdminPanelOpen(false);
      } catch (e) {
        alert('Erro ao salvar no banco de dados.');
      }
    } else {
      alert('O sistema não reconheceu o formato MBFT. Certifique-se de copiar os campos completos, incluindo os rótulos "Tipificação Resumida:" e "Código do Enquadramento:".');
    }
    setIsProcessing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          const list = Array.isArray(data) ? data : [data];
          for (const item of list) {
            if (!item.codigo_enquadramento) continue;
            await setDoc(doc(db, 'infractions', item.codigo_enquadramento), {
              ...item,
              id: item.codigo_enquadramento,
              status: 'ativo',
              ultima_atualizacao: new Date().toISOString()
            });
          }
          alert('Importação concluída.');
        } catch (err) {
          alert('Arquivo JSON inválido.');
        }
      } else {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

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
      alert(`Atuação registrada em ${inf.codigo_enquadramento}`);
      setQuickCode('');
    } catch (e) {
      alert('Erro ao registrar.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleDelete = async (inf: Infraction) => {
    if (!confirm(`Deseja excluir a infração ${inf.codigo_enquadramento}?`)) return;
    try {
      await deleteDoc(doc(db, 'infractions', inf.id));
      setSelectedInfraction(null);
    } catch (e) {
      alert('Erro ao excluir.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-900 flex flex-col justify-center px-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic">Multas Rápidas</h1>
          <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest">Acesso Restrito ao Agente</p>
        </div>
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-4 border-b-8 border-blue-100">
          <input 
            type="email" 
            placeholder="E-mail Funcional" 
            className="w-full p-5 bg-slate-50 rounded-3xl outline-none border border-slate-100 font-bold" 
            id="login-email" 
          />
          <button 
            onClick={() => {
              const email = (document.getElementById('login-email') as HTMLInputElement).value;
              if (!email) { alert("Informe seu e-mail"); return; }
              const role = email.toLowerCase().includes('admin') ? UserRole.GESTOR : UserRole.AGENTE;
              setUser({ id: 'agt-' + Date.now(), name: 'Agente Silva', email, role });
            }}
            className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest btn-active shadow-xl shadow-blue-600/20"
          >
            Entrar no Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-slate-50 relative overflow-hidden safe-top">
      <header className="bg-blue-800 text-white px-6 pt-6 pb-8 sticky top-0 z-20 shadow-xl rounded-b-[2.5rem] border-b-4 border-blue-900/20">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter italic">Multas Rápidas</h1>
            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">{user.role} - MBFT DIGITAL</span>
          </div>
          <button onClick={() => setUser(null)} className="p-2 opacity-50"><Icons.Logout /></button>
        </div>

        {activeTab === 'search' && !selectedInfraction && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                className="flex-1 px-5 py-4 bg-white/10 border border-white/20 rounded-3xl text-white placeholder-white/40 outline-none font-black text-sm uppercase"
                placeholder="CÓDIGO (EX: 501-00)"
                value={quickCode}
                onChange={e => setQuickCode(e.target.value)}
                onKeyPress={(e) => {
                    if(e.key === 'Enter') {
                        const found = infractions.find(i => i.codigo_enquadramento === quickCode);
                        if(found) handleRecord(found); else alert('Código não encontrado');
                    }
                }}
              />
              <button onClick={() => {
                const found = infractions.find(i => i.codigo_enquadramento === quickCode);
                if(found) handleRecord(found); else alert('Não encontrado');
              }} className="bg-orange-500 text-white px-6 rounded-3xl font-black text-xs btn-active shadow-lg shadow-orange-500/30 transition-transform active:scale-95 uppercase">Buscar</button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center text-blue-400 transition-colors"><Icons.Search /></div>
              <input 
                className="w-full pl-14 pr-6 py-4 bg-blue-900/40 border border-blue-700/50 rounded-3xl text-white placeholder-blue-300/40 outline-none font-bold text-sm focus:ring-2 focus:ring-blue-400"
                placeholder="Nome da infração ou artigo..."
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
            <div className="flex justify-between items-center mb-8">
              <button onClick={() => setSelectedInfraction(null)} className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] bg-blue-50 px-5 py-3 rounded-full btn-active transition-all"><Icons.ArrowLeft /> Voltar</button>
              {user.role === UserRole.GESTOR && (
                <button onClick={() => handleDelete(selectedInfraction)} className="text-red-500 p-3 bg-red-50 rounded-2xl btn-active hover:bg-red-100 transition-all"><Icons.Trash /></button>
              )}
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <NatureTag natureza={selectedInfraction.natureza} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Art. {selectedInfraction.artigo}</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-blue-600 tracking-tighter">{selectedInfraction.codigo_enquadramento}</span>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedInfraction.titulo_curto}</h3>
              
              <div className="p-6 bg-slate-900 rounded-[2.5rem] border-b-8 border-blue-950">
                <h4 className="text-[10px] font-black text-blue-400 uppercase mb-2 tracking-widest">Tipificação MBFT</h4>
                <p className="text-sm text-blue-100 font-medium italic leading-relaxed">"{selectedInfraction.descricao}"</p>
              </div>

              <div className="space-y-4">
                <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
                  <h4 className="text-[10px] font-black text-green-700 uppercase mb-3 tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Quando Atuar</h4>
                  <ul className="text-xs font-bold text-green-900 space-y-2">{selectedInfraction.quando_atuar.map((t, idx) => <li key={idx}>• {t}</li>)}</ul>
                </div>
                <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <h4 className="text-[10px] font-black text-red-700 uppercase mb-3 tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Não Atuar</h4>
                  <ul className="text-xs font-bold text-red-900 space-y-2">{selectedInfraction.quando_nao_atuar.map((t, idx) => <li key={idx}>• {t}</li>)}</ul>
                </div>
              </div>

              <button 
                onClick={() => handleRecord(selectedInfraction)} 
                disabled={isRecording}
                className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs btn-active shadow-2xl transition-all hover:bg-blue-700 disabled:bg-slate-300"
              >
                {isRecording ? 'SALVANDO...' : 'REGISTRAR ATUAÇÃO'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'search' && (
              searchQuery ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resultados ({filteredInfractions.length})</p>
                  {filteredInfractions.map(inf => (
                    <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full text-left bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 btn-active flex flex-col gap-2 transition-all hover:shadow-xl">
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
                    <p className="font-black text-xs uppercase tracking-widest mt-4">Digite para buscar</p>
                  </div>
                  {topInfractions.length > 0 && (
                    <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest flex items-center gap-2"><Icons.Flash /> Infrações Frequentes</h3>
                        <div className="space-y-5">
                            {topInfractions.map(inf => (
                                <button key={inf.id} onClick={() => setSelectedInfraction(inf)} className="w-full flex justify-between items-center text-left group">
                                    <span className="text-sm font-black text-slate-700 truncate group-hover:text-blue-600 transition-colors">{inf.titulo_curto}</span>
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
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900">Gestão</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Base MBFT</p>
                  </div>
                  <button 
                    onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-[1.8rem] font-black text-xs uppercase shadow-xl shadow-blue-600/30 btn-active"
                  >
                    <Icons.Plus /> {isAdminPanelOpen ? 'Fechar' : 'Nova Multa'}
                  </button>
                </div>

                {isAdminPanelOpen && (
                  <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-4 border-blue-50 space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2"><Icons.Upload /> Processamento Manual</h3>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Importe um arquivo JSON da base ou cole o texto de uma ficha do manual para o sistema interpretar.</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-10 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer bg-slate-50 border-slate-100 hover:border-blue-200 transition-colors"
                        >
                            <Icons.File />
                            <p className="text-xs font-black uppercase text-slate-400 mt-2">Selecionar Arquivo (.json / .txt)</p>
                            <input ref={fileInputRef} type="file" accept=".json,.txt,.csv" className="hidden" onChange={handleFileUpload} />
                        </div>

                        <div className="relative">
                            <textarea 
                              className="w-full h-40 p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 no-scrollbar transition-all"
                              placeholder="Cole o texto da ficha técnica aqui para o sistema ler..."
                              value={importText}
                              onChange={(e) => setImportText(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                      onClick={handleImportSystemic}
                      disabled={isProcessing || !importText.trim()}
                      className="w-full py-6 rounded-[2rem] bg-slate-900 text-white font-black uppercase text-xs tracking-[0.2em] btn-active disabled:bg-slate-200 shadow-2xl shadow-slate-900/40"
                    >
                      {isProcessing ? 'PROCESSANDO...' : 'CADASTRAR NO SISTEMA'}
                    </button>
                  </div>
                )}

                <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Base de Dados ({infractions.length})</h3>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
                    {infractions.sort((a,b) => a.codigo_enquadramento.localeCompare(b.codigo_enquadramento)).map(inf => (
                      <div key={inf.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.8rem] border border-slate-100 hover:bg-white hover:shadow-lg transition-all group">
                        <div className="flex-1 truncate mr-4">
                          <p className="text-[11px] font-black text-blue-600 mb-1">{inf.codigo_enquadramento}</p>
                          <p className="text-sm font-bold text-slate-800 truncate">{inf.titulo_curto}</p>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setSelectedInfraction(inf)} className="p-3 text-blue-500"><Icons.Search /></button>
                           <button onClick={() => handleDelete(inf)} className="p-3 text-red-300 hover:text-red-600 transition-colors btn-active"><Icons.Trash /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="py-24 text-center text-slate-300">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 opacity-30 text-slate-500"><Icons.History /></div>
                <p className="font-black text-xs uppercase tracking-[0.2em]">Sem Atividade Recente</p>
              </div>
            )}
          </div>
        )}
      </main>

      {!selectedInfraction && (
        <div className="fixed bottom-10 left-0 right-0 px-8 z-30">
            <nav className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-2xl rounded-[3.5rem] flex justify-around items-center p-3 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] safe-bottom">
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
