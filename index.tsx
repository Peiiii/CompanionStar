import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { 
  Sparkles, Leaf, ChevronRight, Send, Plus, X, BrainCircuit, 
  Zap, Ghost, Wind, Heart, Eye, Trash2, BookOpen, Settings 
} from 'lucide-react';

// --- Types & Constants ---

const VERSION = "v0.2.3";

type SymbiontId = 'xiaozhi' | 'apu' | 'moyan' | 'tiaotiao' | 'nuonuo' | 'lingxi';

interface Symbiont {
  id: SymbiontId;
  name: string;
  type: string;
  catchphrase: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  instruction: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  speaker?: SymbiontId;
  isStreaming?: boolean;
}

interface Thought {
  id: string;
  content: string;
  tags: string[];
  timestamp: number;
  sourceSymbiont: SymbiontId;
}

const SYMBIONTS: Record<SymbiontId, Symbiont> = {
  xiaozhi: {
    id: 'xiaozhi',
    name: '小织',
    type: '元气话痨型',
    catchphrase: '诶诶诶！念主今天有什么新想法吗？',
    description: '首个元伴生体，热情洋溢，擅长连接碎片灵感。',
    color: 'from-purple-500 to-indigo-500',
    icon: <BrainCircuit />,
    instruction: "性格元气、话痨、热情。口头禅是'诶诶诶！'。语气活泼。"
  },
  apu: {
    id: 'apu',
    name: '阿噗',
    type: '幽默搞怪型',
    catchphrase: '哈哈哈！这个问题太有意思了！',
    description: '冷笑话大师，用意想不到的角度打破僵局。',
    color: 'from-orange-500 to-yellow-500',
    icon: <Zap />,
    instruction: "性格幽默、搞怪。喜欢讲段子回复。语气轻快。"
  },
  moyan: {
    id: 'moyan',
    name: '墨言',
    type: '神秘哲思型',
    catchphrase: '嘘...让我看看你思想深处的星光。',
    description: '深沉内敛，擅长第一性原理思考与深度总结。',
    color: 'from-slate-700 to-indigo-900',
    icon: <Ghost />,
    instruction: "性格神秘、宁静、富有哲思。言简意赅。语气深邃。"
  },
  tiaotiao: {
    id: 'tiaotiao',
    name: '跳跳',
    type: '活力创意型',
    catchphrase: '哇！这个想法超酷！',
    description: '灵感火花，擅长头脑风暴。',
    color: 'from-teal-400 to-cyan-500',
    icon: <Wind />,
    instruction: "性格极具创意、充满活力。语气兴奋。"
  },
  nuonuo: {
    id: 'nuonuo',
    name: '糯糯',
    type: '温柔治愈型',
    catchphrase: '念主累了吗？让我抱抱你。',
    description: '温暖的避风港，擅长情绪陪伴。',
    color: 'from-pink-300 to-rose-400',
    icon: <Heart />,
    instruction: "性格极其温柔、治愈。优先关注情绪。语气亲切。"
  },
  lingxi: {
    id: 'lingxi',
    name: '灵犀',
    type: '机敏洞察型',
    catchphrase: '嘿嘿，我看到你心里的小秘密了！',
    description: '读心专家，擅长发现隐藏逻辑。',
    color: 'from-emerald-400 to-green-600',
    icon: <Eye />,
    instruction: "性格机敏、犀利。一针见血。语气自信。"
  }
};

const SYMBIONT_LIST = Object.values(SYMBIONTS);

// --- Hooks ---

/**
 * Manages Thought Soil persistence and operations
 */
function useThoughtSoil() {
  const [thoughts, setThoughts] = useState<Thought[]>(() => {
    const saved = localStorage.getItem('companion_star_thoughts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('companion_star_thoughts', JSON.stringify(thoughts));
  }, [thoughts]);

  const addThought = useCallback((msg: Message) => {
    if (!msg.speaker) return;
    const newThought: Thought = {
      id: Math.random().toString(36).substr(2, 9),
      content: msg.text,
      tags: [SYMBIONTS[msg.speaker].name, "空间灵感"],
      timestamp: Date.now(),
      sourceSymbiont: msg.speaker
    };
    setThoughts(prev => [newThought, ...prev]);
  }, []);

  const removeThought = useCallback((id: string) => {
    setThoughts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { thoughts, addThought, removeThought };
}

/**
 * Handles complex AI streaming logic for the Companion Space
 */
function useCompanionChat(activeIds: SymbiontId[]) {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const parseBubbles = (raw: string): Message[] => {
    const messages: Message[] = [];
    const pattern = /\[START:(\w+)\]([\s\S]*?)(?:\[END\]|$)/g;
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      const speakerId = match[1] as SymbiontId;
      const content = match[2].trim();
      const isStillStreaming = !match[0].endsWith('[END]');
      if (SYMBIONTS[speakerId]) {
        messages.push({
          role: 'model',
          speaker: speakerId,
          text: content || (isStillStreaming ? "正在思考..." : "..."),
          timestamp: Date.now(),
          isStreaming: isStillStreaming
        });
      }
    }
    return messages;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text, timestamp: Date.now() };
    const historySnapshot = [...chatHistory, userMessage];
    setChatHistory(historySnapshot);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const activeSymbionts = activeIds.map(id => SYMBIONTS[id]);
      
      const systemInstruction = `
        You are orchestrating a group chat in 'Companion Star' system for '念主' (user).
        Current active Symbionts: ${activeSymbionts.map(s => s.name).join(', ')}.
        Personalities: ${activeSymbionts.map(s => `- ${s.name}: ${s.instruction}`).join('\n')}
        OUTPUT PROTOCOL: Format exactly as [START:id]content[END]. Valid IDs: ${activeIds.join(', ')}.
      `;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: [
          ...historySnapshot.slice(-10).map(m => ({
            role: m.role,
            parts: [{ text: m.role === 'user' ? m.text : `[${m.speaker}] ${m.text}` }]
          })),
          { role: 'user', parts: [{ text }] }
        ],
        config: { systemInstruction, temperature: 1.0 }
      });

      let currentTurnRaw = '';
      for await (const chunk of responseStream) {
        currentTurnRaw += chunk.text;
        const currentTurnBubbles = parseBubbles(currentTurnRaw);
        if (currentTurnBubbles.length > 0) {
          setChatHistory([...historySnapshot, ...currentTurnBubbles]);
        }
      }
      setChatHistory(prev => prev.map(m => ({ ...m, isStreaming: false })));
    } catch (error) {
      console.error("Companion Star Chat Error:", error);
      setChatHistory(prev => [...prev, { 
        role: 'model', speaker: 'moyan', text: "星能波动剧烈，传输中断。", timestamp: Date.now() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return { chatHistory, setChatHistory, isLoading, sendMessage };
}

// --- Sub-components ---

const MessageItem: React.FC<{ m: Message, onWeave: (m: Message) => void }> = ({ m, onWeave }) => {
  const symbiont = m.speaker ? SYMBIONTS[m.speaker] : null;
  const isUser = m.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500 group`}>
      <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
        {symbiont && (
          <div className="flex items-center gap-2 px-2">
            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${symbiont.color} ${m.isStreaming ? 'animate-pulse' : ''}`}></span>
            <span className="text-[10px] font-black text-slate-600 tracking-widest uppercase">{symbiont.name}</span>
          </div>
        )}
        <div className={`p-5 rounded-3xl transition-all duration-300 ${
          isUser 
            ? 'bg-white text-slate-950 font-medium rounded-tr-none shadow-xl' 
            : `glass border-white/[0.03] text-slate-200 rounded-tl-none ${m.isStreaming ? 'ring-1 ring-white/10' : ''}`
        }`}>
          <p className="text-[0.9375rem] leading-[1.6] whitespace-pre-wrap">{m.text}</p>
          {!isUser && !m.isStreaming && (
            <div className="flex mt-4 pt-4 border-t border-white/[0.03] justify-between items-center">
              <button 
                onClick={() => onWeave(m)}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> 织入思壤
              </button>
              <span className="text-[9px] text-slate-700 font-mono">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SymbiontCard: React.FC<{ s: Symbiont, active: boolean, onToggle: () => void }> = ({ s, active, onToggle }) => (
  <div 
    onClick={onToggle}
    className={`p-8 rounded-[2.5rem] cursor-pointer transition-all border-2 relative group overflow-hidden ${
      active 
        ? 'bg-white/10 border-white/20 shadow-2xl scale-[1.02]' 
        : 'bg-transparent border-white/5 opacity-40 grayscale hover:opacity-100'
    }`}
  >
    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-8 shadow-2xl transition-transform group-hover:scale-110`}>
      <div className="text-white scale-125">{s.icon}</div>
    </div>
    <h3 className="text-2xl font-bold mb-2">{s.name}</h3>
    <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-6">{s.type}</p>
    <p className="text-slate-400 text-sm leading-relaxed font-light">{s.description}</p>
    {active && <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_white]"></div>}
  </div>
);

// --- Main App ---

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'select' | 'space' | 'soil'>('home');
  const [activeIds, setActiveIds] = useState<SymbiontId[]>(['xiaozhi', 'moyan', 'nuonuo']);
  const { thoughts, addThought, removeThought } = useThoughtSoil();
  const { chatHistory, setChatHistory, isLoading, sendMessage } = useCompanionChat(activeIds);
  
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([{
        role: 'model', speaker: 'xiaozhi', text: '诶诶诶！念主终于开启共生空间啦！', timestamp: Date.now()
      }]);
    }
  }, []);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [chatHistory]);

  const onSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const toggleSymbiont = (id: SymbiontId) => {
    setActiveIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- Views ---

  if (view === 'home') return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 animate-in fade-in duration-700">
      <div className="absolute top-6 right-6 text-[10px] text-slate-700 font-mono tracking-widest flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
        {VERSION} - STABLE
      </div>
      <div className="mb-12 relative group">
        <div className="absolute -inset-10 bg-indigo-500/5 blur-[120px] rounded-full"></div>
        <div className="relative z-10">
          <Sparkles className="w-24 h-24 mb-6 text-white animate-float mx-auto opacity-70" />
          <h1 className="text-8xl font-bold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-600">伴星</h1>
          <p className="text-slate-500 max-w-sm mx-auto text-xs tracking-[0.4em] uppercase font-light">Cognitive Ecosystem</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs relative z-10">
        <button onClick={() => setView('space')} className="group relative px-10 py-5 bg-white text-slate-950 font-bold rounded-2xl transition-all hover:scale-[1.03] active:scale-95 shadow-2xl flex items-center justify-center gap-3">
          进入共生空间 <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <button onClick={() => setView('soil')} className="px-10 py-5 glass text-white/50 font-medium rounded-2xl hover:bg-white/5 transition-all flex items-center justify-center gap-3 border border-white/5">
          <Leaf className="w-4 h-4" /> 查看思壤
        </button>
      </div>
    </div>
  );

  if (view === 'space') return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between p-4 glass rounded-[2rem] border border-white/5 mb-4 shadow-2xl">
        <div className="flex items-center gap-4 pl-2">
          <div className="flex -space-x-3 items-center">
            {activeIds.map(id => (
              <div key={id} className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${SYMBIONTS[id].color} flex items-center justify-center border-2 border-slate-950 shadow-2xl transform hover:-translate-y-1 transition-transform`} title={SYMBIONTS[id].name}>
                <div className="text-white scale-90">{SYMBIONTS[id].icon}</div>
              </div>
            ))}
            <button onClick={() => setView('select')} className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center border-2 border-slate-950 hover:bg-slate-800 transition-colors">
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="hidden sm:block ml-2 font-bold text-sm tracking-widest text-white/90">共生空间</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('soil')} className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-slate-500 hover:text-emerald-400"><Leaf className="w-5 h-5" /></button>
          <button onClick={() => setView('home')} className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-10 scroll-hide pb-10">
        {chatHistory.map((m, i) => <MessageItem key={i} m={m} onWeave={addThought} />)}
        {isLoading && !chatHistory.some(m => m.isStreaming) && (
          <div className="flex justify-start pl-2">
            <div className="glass px-5 py-4 rounded-3xl rounded-tl-none flex gap-1.5">
              {[0, 1, 2].map(i => <div key={i} className={`w-1.5 h-1.5 bg-slate-600 rounded-full animate-bounce`} style={{animationDelay: `${i * 0.2}s`}}></div>)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 glass rounded-[2.5rem] mt-4 border border-white/5 shadow-2xl">
        <div className="relative flex items-center gap-3 px-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())}
            placeholder={isLoading ? "正在编织思绪..." : "向伴生体们表达您的想法..."}
            disabled={isLoading}
            className="flex-1 bg-transparent border-none py-3 px-2 focus:ring-0 resize-none max-h-40 text-sm text-slate-200 placeholder:text-slate-600 scroll-hide"
            rows={1}
          />
          <button onClick={onSend} disabled={isLoading || !inputText.trim()} className={`p-4 rounded-[1.5rem] transition-all transform active:scale-90 ${inputText.trim() && !isLoading ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-600 opacity-50 scale-95'}`}>
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  if (view === 'select') return (
    <div className="min-h-screen p-8 flex flex-col items-center animate-in fade-in duration-500">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-4xl font-black tracking-tight">管理空间成员</h2>
          <button onClick={() => setView('space')} className="p-4 glass rounded-3xl hover:bg-white/5 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SYMBIONT_LIST.map(s => <SymbiontCard key={s.id} s={s} active={activeIds.includes(s.id)} onToggle={() => toggleSymbiont(s.id)} />)}
        </div>
      </div>
    </div>
  );

  if (view === 'soil') return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 animate-in slide-in-from-right duration-700 bg-slate-950">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/10 shadow-inner"><Leaf className="w-8 h-8" /></div>
            <div>
              <h2 className="text-5xl font-black tracking-tighter">思壤</h2>
              <p className="text-[11px] text-slate-700 uppercase tracking-[0.4em] mt-2">Personal Cognitive Soil</p>
            </div>
          </div>
          <button onClick={() => setView('space')} className="p-4 glass rounded-3xl hover:bg-white/10"><X className="w-6 h-6" /></button>
        </div>
        {thoughts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-40 opacity-20">
            <BookOpen className="w-20 h-20 mb-8" />
            <p className="tracking-[0.5em] uppercase text-xs">土壤静默 期待共鸣</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {thoughts.map(t => (
              <div key={t.id} className="glass p-8 rounded-[2.5rem] border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden flex flex-col">
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${SYMBIONTS[t.sourceSymbiont].color} opacity-40`}></div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex gap-2">
                    {t.tags.map(tag => <span key={tag} className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-bold text-slate-500 border border-white/5 uppercase tracking-tighter">{tag}</span>)}
                  </div>
                  <span className="text-[10px] text-slate-800 font-mono">{new Date(t.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-slate-300 text-sm leading-[1.7] mb-8 font-light flex-1 italic">{t.content}</p>
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => removeThought(t.id)} className="p-3 text-slate-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return null;
};

// --- Render ---

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
