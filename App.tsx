
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, UserData, DailyLog, ChatMessage, WorkShift, BreakSession } from './types';
import { COLORS, Icons } from './constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { getGeminiResponse } from './services/gemini';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// --- Utilities ---
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ProgressBar: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <div className="flex justify-center space-x-2 my-6">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-2.5 w-8 rounded-full transition-all duration-300 ${
          i < step ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      />
    ))}
  </div>
);

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('SPLASH');
  const [userData, setUserData] = useState<UserData>({
    ageRange: '26-35',
    workHours: 8,
    workAfterHours: false,
    baseStress: 'Neutral',
    baseLoneliness: 'Sometimes',
    hasOnboarded: false,
    isLoggedIn: false,
  });

  const [workShift, setWorkShift] = useState<WorkShift>({
    breaks: [
      { id: 1, label: 'Break 1', status: 'idle' },
      { id: 2, label: 'Break 2', status: 'idle' },
      { id: 3, label: 'Break 3', status: 'idle' },
      { id: 4, label: 'Break 4', status: 'idle' },
      { id: 5, label: 'Break 5', status: 'idle' },
    ]
  });

  const [logs, setLogs] = useState<DailyLog[]>([
    { date: 'Mon', mood: 'Good', stressLevel: 2, socialized: true, sleepHours: 7 },
    { date: 'Tue', mood: 'Okay', stressLevel: 3, socialized: false, sleepHours: 6 },
    { date: 'Wed', mood: 'Great', stressLevel: 1, socialized: true, sleepHours: 8 },
    { date: 'Thu', mood: 'Okay', stressLevel: 4, socialized: false, sleepHours: 5 },
    { date: 'Fri', mood: 'Great', stressLevel: 1, socialized: true, sleepHours: 8 },
  ]);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const wellnessScore = useMemo(() => {
    const logWeight = logs.length > 0 ? (logs.reduce((acc, curr) => acc + (5 - curr.stressLevel), 0) / logs.length) * 20 : 70;
    return Math.min(100, Math.floor(logWeight));
  }, [logs]);

  // --- Screens ---

  const SplashScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-white overflow-hidden text-center">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-1000">
        <Icons.Logo size="w-32 h-32 mx-auto" />
        <h1 className="text-5xl font-black mt-8 mb-2 tracking-tighter text-gray-900">FILO</h1>
        <p className="text-xl text-gray-500 font-medium italic mb-12">
          “Feel better, daily”
        </p>
        <button
          onClick={() => setCurrentScreen('LOGIN')}
          className="w-full py-5 bg-indigo-600 text-white rounded-[28px] text-lg font-bold shadow-2xl hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Get Started
        </button>
      </div>
    </div>
  );

  const LoginScreen = () => {
    const [mobile, setMobile] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = () => {
      setIsLoading(true);
      setTimeout(() => {
        setUserData({ ...userData, isLoggedIn: true, loginMethod: 'google' });
        setCurrentScreen('CONSENT');
        setIsLoading(false);
      }, 1500);
    };

    const handleMobileLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (mobile.length < 10) return;
      setIsLoading(true);
      setTimeout(() => {
        setUserData({ ...userData, isLoggedIn: true, loginMethod: 'mobile' });
        setCurrentScreen('CONSENT');
        setIsLoading(false);
      }, 1500);
    };

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[48px] shadow-xl animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="text-center mb-10">
            <Icons.Logo size="w-20 h-20 mx-auto mb-6" />
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Welcome to FILO</h2>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Personalized Wellness Companion</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-4 bg-white border-2 border-gray-100 rounded-[28px] flex items-center justify-center space-x-3 font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <svg className="w-6 h-6" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center space-x-4 py-4">
               <div className="flex-1 h-px bg-gray-100"></div>
               <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">or mobile</span>
               <div className="flex-1 h-px bg-gray-100"></div>
            </div>

            <form onSubmit={handleMobileLogin} className="space-y-4">
               <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-gray-400 border-r pr-3 border-gray-100">+1</div>
                  <input 
                    type="tel" 
                    placeholder="Mobile Number" 
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-20 pr-6 py-4 bg-gray-50 border-2 border-transparent rounded-[28px] focus:bg-white focus:border-indigo-600/20 focus:ring-0 outline-none font-bold text-gray-900 transition-all shadow-sm"
                  />
               </div>
               <button 
                 type="submit"
                 disabled={mobile.length < 10 || isLoading}
                 className={`w-full py-5 rounded-[28px] font-black text-white shadow-2xl transition-all active:scale-[0.98] ${mobile.length >= 10 ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-gray-200 cursor-not-allowed shadow-none'}`}
               >
                 {isLoading ? 'Verifying...' : 'Sign In'}
               </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const OnboardingLayout: React.FC<{ children: React.ReactNode, step: number }> = ({ children, step }) => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-xl bg-white p-10 rounded-[48px] shadow-xl flex flex-col min-h-[500px]">
        <ProgressBar step={step} total={3} />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-10 pb-32 md:pb-10">
      <header className="flex justify-between items-center bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100">
        <div className="flex items-center space-x-5">
          <Icons.Logo size="w-14 h-14" />
          <div>
            <h1 className="text-3xl font-black text-gray-900 leading-none">FILO</h1>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Feel better, daily</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden md:block text-right">
             <p className="text-sm font-black text-gray-900">Alex Johnson</p>
             <p className="text-xs text-indigo-500 font-bold">Premium Plan</p>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-2xl overflow-hidden border-2 border-white shadow-md cursor-pointer" onClick={() => setCurrentScreen('PROFILE')}>
            <img src="https://picsum.photos/100/100?random=1" alt="profile" />
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Score & Status */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-600 p-8 rounded-[40px] shadow-xl text-white relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 opacity-10 group-hover:scale-110 transition-transform duration-500"><Icons.Logo size="w-40 h-40" /></div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] opacity-80 mb-6">Wellness Index</h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-7xl font-black tracking-tighter">{wellnessScore}</span>
                <span className="text-indigo-200 text-2xl font-bold">/100</span>
              </div>
              <div className="w-full bg-indigo-900/30 h-3 rounded-full mt-10 overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-1000 ease-out" 
                  style={{ width: `${wellnessScore}%` }} 
                />
              </div>
              <p className="mt-6 text-indigo-100 font-bold text-sm">⬆ Improved by 5% this week</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white p-7 rounded-[32px] card-shadow border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-orange-500 text-xl">🔥</span>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Burnout Risk</span>
                  </div>
                  <p className="text-2xl font-black text-amber-500">Normal</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl">
                   <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="bg-white p-7 rounded-[32px] card-shadow border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-indigo-500 text-xl">😊</span>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Vitality</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-500">High</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl">
                   <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={() => setCurrentScreen('WORK_TRACKER')} 
              className="relative p-8 bg-white rounded-[40px] card-shadow border border-gray-100 flex flex-col items-start space-y-4 hover:shadow-lg hover:translate-y-[-2px] transition-all group overflow-hidden"
            >
              <div className="bg-indigo-600 p-4 rounded-2xl group-hover:scale-110 transition-transform"><Icons.Clock className="text-white w-8 h-8" /></div>
              <div className="text-left">
                <h3 className="text-xl font-black text-gray-900">Work Shift</h3>
                <p className="text-sm text-gray-400 font-medium mt-1">Log breaks & track productivity.</p>
              </div>
            </button>
            <button 
              onClick={() => setCurrentScreen('CALL_SELECT')} 
              className="relative p-8 bg-white rounded-[40px] card-shadow border border-gray-100 flex flex-col items-start space-y-4 hover:shadow-lg hover:translate-y-[-2px] transition-all group overflow-hidden"
            >
              <div className="bg-emerald-500 p-4 rounded-2xl group-hover:scale-110 transition-transform"><Icons.Call className="text-white w-8 h-8" /></div>
              <div className="text-left">
                <h3 className="text-xl font-black text-gray-900">Voice Call</h3>
                <p className="text-sm text-gray-400 font-medium mt-1">Connect with AI or a Peer.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Right Column - Secondary Actions & Insights */}
        <div className="space-y-8">
           <div className="bg-gray-900 p-8 rounded-[40px] shadow-xl text-white">
              <h3 className="text-lg font-black mb-4">Quick Insights</h3>
              <div className="space-y-5">
                 <div className="flex space-x-4 items-start">
                    <div className="text-2xl">💡</div>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">Systematic breaks are reducing your cortisol levels. Keep it up!</p>
                 </div>
                 <div className="flex space-x-4 items-start border-t border-gray-800 pt-5">
                    <div className="text-2xl">🌙</div>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">Your sleep consistency is high (84%). Great for mental clarity.</p>
                 </div>
              </div>
           </div>

           <div className="space-y-4">
              <button onClick={() => setCurrentScreen('CHECK_IN')} className="w-full flex items-center justify-between p-6 bg-white rounded-[32px] border border-gray-100 card-shadow hover:bg-gray-50 transition-all font-black">
                <div className="flex items-center space-x-4"><div className="bg-gray-50 p-3 rounded-xl">📝</div><span>Check-in</span></div>
                <span className="text-gray-300">›</span>
              </button>
              <button onClick={() => setCurrentScreen('INSIGHTS')} className="w-full flex items-center justify-between p-6 bg-white rounded-[32px] border border-gray-100 card-shadow hover:bg-gray-50 transition-all font-black">
                <div className="flex items-center space-x-4"><div className="bg-gray-50 p-3 rounded-xl">🤖</div><span>AI Review</span></div>
                <span className="text-gray-300">›</span>
              </button>
           </div>
        </div>
      </div>
    </div>
  );

  const WorkTracker = () => (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10 pb-32 md:pb-10">
      <header className="flex items-center space-x-4">
        <button onClick={() => setCurrentScreen('DASHBOARD')} className="p-4 bg-white rounded-full shadow-sm hover:shadow-md transition-all">←</button>
        <h1 className="text-2xl font-black text-gray-900">Work Shift Tracker</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-indigo-600 p-10 rounded-[48px] shadow-2xl text-white space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black">Current Day</h2>
              <p className="text-indigo-200 mt-2 font-bold uppercase tracking-widest text-xs">
                {workShift.shiftStart ? `Started: ${workShift.shiftStart}` : 'Not Clocked In'}
              </p>
            </div>
            <Icons.Clock className="w-12 h-12 text-white/30" />
          </div>
          <button 
            onClick={() => setWorkShift(prev => ({
              ...prev,
              shiftStart: prev.shiftStart ? prev.shiftStart : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              shiftEnd: prev.shiftStart ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
            }))}
            className={`w-full py-6 rounded-3xl font-black text-xl shadow-xl transition-all active:scale-95 ${workShift.shiftEnd ? 'bg-indigo-400 opacity-50' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}
          >
            {workShift.shiftEnd ? 'Day Finished' : workShift.shiftStart ? 'Clock Out' : 'Clock In'}
          </button>
        </div>

        <div className="bg-white p-10 rounded-[48px] card-shadow border border-gray-100">
           <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8 px-2 text-center">Break Logs</h3>
           <div className="space-y-4">
             {workShift.breaks.map(b => (
               <div key={b.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-[28px] hover:bg-gray-100 transition-all border border-transparent hover:border-indigo-100">
                 <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${b.status === 'done' ? 'bg-emerald-100 text-emerald-600' : b.status === 'active' ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-white shadow-sm text-gray-400'}`}>
                      {b.id}
                    </div>
                    <div>
                       <p className="font-black text-gray-800 text-sm">{b.label}</p>
                       <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                         {b.start ? `${b.start} ${b.end ? `- ${b.end}` : ''}` : 'Pending'}
                       </p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setWorkShift(prev => ({
                     ...prev,
                     breaks: prev.breaks.map(br => {
                       if (br.id === b.id) {
                         if (br.status === 'idle') return { ...br, status: 'active', start: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                         if (br.status === 'active') return { ...br, status: 'done', end: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                       }
                       return br;
                     })
                   }))}
                   disabled={b.status === 'done' || !workShift.shiftStart}
                   className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${b.status === 'idle' ? 'bg-white text-indigo-600 border border-indigo-100 shadow-sm' : b.status === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                 >
                   {b.status === 'idle' ? 'In' : b.status === 'active' ? 'Out' : 'Done'}
                 </button>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );

  const AIChat = () => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [chatHistory, isTyping]);

    const handleSend = async () => {
      if (!input.trim()) return;
      const userMsg: ChatMessage = { role: 'user', text: input };
      setChatHistory(prev => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);
      const aiText = await getGeminiResponse(chatHistory, input);
      setChatHistory(prev => [...prev, { role: 'model', text: aiText }]);
      setIsTyping(false);
    };

    return (
      <div className="flex flex-col h-full bg-white md:bg-gray-50 md:p-10">
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full bg-white md:rounded-[48px] md:shadow-2xl overflow-hidden">
          <header className="px-8 py-6 flex items-center border-b border-gray-50 bg-white sticky top-0 z-20">
            <button onClick={() => setCurrentScreen('DASHBOARD')} className="mr-6 p-3 bg-gray-50 rounded-full hover:bg-gray-100 transition-all">←</button>
            <div className="flex items-center space-x-4">
               <Icons.Logo size="w-12 h-12" />
               <div>
                  <h2 className="text-xl font-black text-gray-900 leading-tight">FILO AI Support</h2>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Active Listening</span>
                  </div>
               </div>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">
            {chatHistory.length === 0 && (
              <div className="bg-white p-12 rounded-[48px] text-center shadow-sm border border-gray-100 max-w-lg mx-auto mt-10">
                <div className="text-5xl mb-6">🧘</div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">I'm all ears.</h3>
                <p className="text-gray-500 font-medium leading-relaxed italic">Talk to me about your day, your stress, or anything on your mind. This is a private, judgement-free space.</p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-5 duration-500`}>
                <div className={`max-w-[75%] p-6 rounded-[32px] shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-700 border border-gray-50 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white px-8 py-5 rounded-[32px] rounded-tl-none shadow-sm flex space-x-2 items-center">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-white border-t border-gray-50">
            <div className="flex space-x-4 max-w-3xl mx-auto bg-gray-50 p-3 rounded-[32px] shadow-inner border border-gray-100">
              <input 
                type="text" 
                placeholder="Share your thoughts..." 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="flex-1 bg-transparent border-none px-6 py-3 text-base focus:ring-0 focus:outline-none font-medium text-gray-900"
              />
              <button 
                onClick={handleSend}
                className="bg-indigo-600 text-white p-5 rounded-[24px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'SPLASH': return <SplashScreen />;
      case 'LOGIN': return <LoginScreen />;
      case 'CONSENT': return (
        <OnboardingLayout step={0}>
          <h2 className="text-4xl font-black mt-8 mb-6 leading-tight">Your Privacy Matters</h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-10">We prioritize your well-being and data security. FILO uses AI to analyze patterns and provide empathetic support, keeping your identity safe.</p>
          <div className="space-y-6">
            <div className="flex items-start bg-gray-50 p-6 rounded-3xl">
              <input type="checkbox" id="consent" className="mt-1.5 w-6 h-6 rounded border-gray-300 text-indigo-600 cursor-pointer" defaultChecked />
              <label htmlFor="consent" className="ml-4 text-gray-700 font-bold cursor-pointer select-none">I agree to the Terms of Service & Privacy Policy.</label>
            </div>
            <button onClick={() => setCurrentScreen('ONBOARDING_AGE')} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all">Agree & Continue</button>
            <p className="text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] py-4">NOT A MEDICAL PROFESSIONAL</p>
          </div>
        </OnboardingLayout>
      );
      case 'ONBOARDING_AGE': return (
        <OnboardingLayout step={1}>
          <h3 className="text-3xl font-black mt-8 mb-8">What's your age range?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['18–25', '26–35', '36–45', '45+'].map(age => (
              <button key={age} onClick={() => setUserData({ ...userData, ageRange: age })} className={`p-8 rounded-[32px] border-4 font-black text-xl transition-all ${userData.ageRange === age ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-transparent hover:border-indigo-100'}`}>{age}</button>
            ))}
          </div>
          <button onClick={() => setCurrentScreen('ONBOARDING_WORK')} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl mt-auto">Next Step</button>
        </OnboardingLayout>
      );
      case 'ONBOARDING_WORK': return (
        <OnboardingLayout step={2}>
           <h3 className="text-3xl font-black mt-8 mb-4">Work Habits</h3>
           <div className="space-y-12 py-10">
              <div>
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 block">Hours worked daily</label>
                <input type="range" min="0" max="14" value={userData.workHours} onChange={(e) => setUserData({...userData, workHours: parseInt(e.target.value)})} className="w-full h-4 bg-gray-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                <div className="flex justify-between mt-6"><span className="text-5xl font-black text-indigo-600">{userData.workHours}</span><span className="text-gray-300 font-bold self-end uppercase">Hours</span></div>
              </div>
              <div className="flex items-center justify-between p-8 bg-gray-50 rounded-[40px]">
                <h3 className="font-bold text-gray-700">Work after hours?</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={userData.workAfterHours} onChange={(e) => setUserData({...userData, workAfterHours: e.target.checked})} />
                  <div className="w-16 h-8 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-8 shadow-inner"></div>
                </label>
              </div>
           </div>
           <button onClick={() => setCurrentScreen('ONBOARDING_WELLBEING')} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl mt-auto">Next Step</button>
        </OnboardingLayout>
      );
      case 'ONBOARDING_WELLBEING': return (
        <OnboardingLayout step={3}>
           <h3 className="text-3xl font-black mt-8 mb-8">Baseline Well-being</h3>
           <div className="space-y-10">
              <div className="bg-gray-50 p-10 rounded-[48px]">
                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8 text-center">Daily Stress</h4>
                <div className="flex justify-between text-5xl">
                  {['😌', '🙂', '😐', '😟', '😣'].map((emoji, i) => (
                    <button key={i} className={`transition-all duration-300 ${userData.baseStress === emoji ? 'scale-150 drop-shadow-xl translate-y-[-8px]' : 'opacity-20 grayscale hover:opacity-40'}`} onClick={() => setUserData({...userData, baseStress: emoji})}>{emoji}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {['Never', 'Sometimes', 'Often', 'Always'].map((option) => (
                  <button key={option} onClick={() => setUserData({...userData, baseLoneliness: option})} className={`p-6 rounded-[32px] border-2 font-black transition-all ${userData.baseLoneliness === option ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-500 border-transparent hover:border-indigo-100'}`}>{option}</button>
                ))}
              </div>
           </div>
           <button onClick={() => { setUserData({ ...userData, hasOnboarded: true }); setCurrentScreen('DASHBOARD'); }} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl mt-auto">Finish Onboarding</button>
        </OnboardingLayout>
      );
      case 'DASHBOARD': return <Dashboard />;
      case 'WORK_TRACKER': return <WorkTracker />;
      case 'CHAT': return <AIChat />;
      case 'ANALYTICS': return <Analytics />;
      case 'PROFILE': return <Profile />;
      case 'CHECK_IN': return <DailyCheckIn />;
      case 'INSIGHTS': return <AIInsights />;
      case 'CALL_SELECT': return <CallSelect />;
      case 'AI_CALL': return <AICallScreen />;
      default: return <Dashboard />;
    }
  };

  const Sidebar = () => (
    <div className="hidden lg:flex flex-col w-24 xl:w-72 h-screen bg-white border-r border-gray-100 sticky top-0 left-0 p-8 z-50">
      <div className="mb-12 flex items-center xl:space-x-4">
        <Icons.Logo size="w-12 h-12" />
        <h2 className="hidden xl:block text-2xl font-black text-gray-900 tracking-tighter">FILO</h2>
      </div>
      <nav className="flex-1 space-y-4">
        {[
          { screen: 'DASHBOARD', icon: Icons.Home, label: 'Dashboard' },
          { screen: 'CHAT', icon: Icons.Chat, label: 'Empathetic Chat' },
          { screen: 'ANALYTICS', icon: Icons.Chart, label: 'Health Trends' },
          { screen: 'PROFILE', icon: Icons.Profile, label: 'Self Profile' },
        ].map(item => (
          <button 
            key={item.screen}
            onClick={() => setCurrentScreen(item.screen as Screen)}
            className={`w-full flex items-center xl:space-x-4 p-4 rounded-3xl transition-all ${currentScreen === item.screen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-300 hover:bg-gray-50 hover:text-gray-500'}`}
          >
            <item.icon className="w-8 h-8 mx-auto xl:mx-0" />
            <span className="hidden xl:block font-black text-sm">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="pt-8 border-t border-gray-50 mt-auto">
        <button onClick={() => setCurrentScreen('SPLASH')} className="w-full flex items-center xl:space-x-4 p-4 text-red-500 font-black hover:bg-red-50 rounded-3xl transition-all">
          <span className="xl:hidden mx-auto text-xl">🚪</span>
          <span className="hidden xl:block text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );

  const MobileNav = () => (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl border-t border-gray-100 flex justify-around p-5 pb-10 z-40 rounded-t-[48px] shadow-[0_-15px_60px_rgba(0,0,0,0.06)]">
      {[
        { screen: 'DASHBOARD', icon: Icons.Home, label: 'Home' },
        { screen: 'CHAT', icon: Icons.Chat, label: 'Talk' },
        { screen: 'ANALYTICS', icon: Icons.Chart, label: 'Stats' },
        { screen: 'PROFILE', icon: Icons.Profile, label: 'Profile' },
      ].map(item => (
        <button 
          key={item.screen}
          onClick={() => setCurrentScreen(item.screen as Screen)} 
          className={`flex flex-col items-center flex-1 transition-all duration-300 ${currentScreen === item.screen ? 'text-indigo-600 scale-110 translate-y-[-6px]' : 'text-gray-300'}`}
        >
          <item.icon className={`w-8 h-8 mb-1 ${currentScreen === item.screen ? 'fill-indigo-50' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
        </button>
      ))}
    </nav>
  );

  const showNavigation = ['DASHBOARD', 'CHAT', 'ANALYTICS', 'PROFILE', 'WORK_TRACKER', 'INSIGHTS', 'CALL_SELECT', 'CHECK_IN'].includes(currentScreen);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {showNavigation && <Sidebar />}
      <div className="flex-1 flex flex-col relative">
        <main className="flex-1 overflow-y-auto">
          {renderScreen()}
        </main>
        {showNavigation && <MobileNav />}
      </div>
    </div>
  );
};

// --- Sub-Components (Cleaned up for Responsive View) ---

const DailyCheckIn = () => {
  const [mood, setMood] = useState('😐');
  const [stress, setStress] = useState(3);
  return (
    <div className="max-w-2xl mx-auto p-10 space-y-12">
      <h1 className="text-4xl font-black text-gray-900 text-center">How's your day?</h1>
      <div className="bg-white p-12 rounded-[48px] card-shadow space-y-12">
        <div className="flex justify-between text-6xl">
          {['😣', '😟', '😐', '🙂', '😊'].map(e => (
            <button key={e} className={`transition-all duration-300 ${mood === e ? 'scale-150 drop-shadow-2xl translate-y-[-10px]' : 'opacity-20 grayscale'}`} onClick={() => setMood(e)}>{e}</button>
          ))}
        </div>
        <div className="space-y-6">
           <div className="flex justify-between items-center"><h3 className="text-lg font-black text-gray-900">Stress Rating</h3><span className="text-4xl font-black text-indigo-600">{stress}</span></div>
           <input type="range" min="1" max="5" value={stress} onChange={e => setStress(parseInt(e.target.value))} className="w-full h-4 bg-gray-100 rounded-full appearance-none cursor-pointer accent-indigo-600" />
        </div>
        <button className="w-full py-6 bg-indigo-600 text-white rounded-[32px] font-black text-2xl shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">Submit Check-in</button>
      </div>
    </div>
  );
};

const Analytics = () => {
  // Mock logs for full weekly view
  const data = [
    { name: 'Mon', mood: 4, stress: 2 },
    { name: 'Tue', mood: 3, stress: 3 },
    { name: 'Wed', mood: 5, stress: 1 },
    { name: 'Thu', mood: 2, stress: 4 },
    { name: 'Fri', mood: 5, stress: 1 },
    { name: 'Sat', mood: 4, stress: 2 },
    { name: 'Sun', mood: 3, stress: 3 },
  ];
  return (
    <div className="max-w-5xl mx-auto p-10 space-y-12 pb-32 md:pb-10">
      <h1 className="text-4xl font-black text-gray-900">Health Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-[48px] card-shadow border border-gray-100">
           <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8">Mood Trend (7 Days)</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={data}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                 <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                 <Line type="monotone" dataKey="mood" stroke="#4F46E5" strokeWidth={6} dot={{r: 6, fill: '#4F46E5', strokeWidth: 4, stroke: '#fff'}} />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white p-10 rounded-[48px] card-shadow border border-gray-100">
           <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8">Stress Intensity</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data}>
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                 <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none'}} />
                 <Bar dataKey="stress" fill="#F59E0B" radius={[12, 12, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
      <div className="bg-indigo-600 p-12 rounded-[60px] shadow-2xl text-white">
         <h3 className="text-2xl font-black mb-4">Deep Insight</h3>
         <p className="text-indigo-100 text-lg leading-relaxed font-medium">Your mood is 35% higher on days where you log at least 3 breaks. Consider optimizing your Thursday schedule where stress spikes regularly.</p>
      </div>
    </div>
  );
};

const AIInsights = () => (
  <div className="max-w-4xl mx-auto p-10 space-y-12">
    <h1 className="text-4xl font-black text-gray-900">AI Health Review</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-10 rounded-[48px] card-shadow border-l-[16px] border-indigo-600 hover:translate-x-2 transition-transform">
        <h3 className="text-2xl font-black mb-4 flex items-center">🕒 Performance</h3>
        <p className="text-gray-500 text-lg italic leading-relaxed font-medium">"Your focus blocks are getting longer. Remember to stretch every 90 minutes to prevent musculoskeletal strain."</p>
      </div>
      <div className="bg-white p-10 rounded-[48px] card-shadow border-l-[16px] border-emerald-500 hover:translate-x-2 transition-transform">
        <h3 className="text-2xl font-black mb-4 flex items-center">📊 Resilience</h3>
        <p className="text-gray-500 text-lg italic leading-relaxed font-medium">"Emotional resilience is at a monthly high. Your usage of the Peer Call feature has a strong correlation with this."</p>
      </div>
    </div>
  </div>
);

const CallSelect = () => (
  <div className="max-w-5xl mx-auto p-10 h-full flex flex-col justify-center space-y-12">
    <div className="text-center">
       <h1 className="text-5xl font-black text-gray-900 tracking-tight">Voice Sanctuary</h1>
       <p className="text-xl text-gray-400 font-bold mt-4">Immediate relief through connection.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
       <button onClick={() => {}} className="group h-80 bg-gradient-to-br from-indigo-600 to-blue-500 p-12 rounded-[60px] text-left relative overflow-hidden shadow-2xl hover:scale-[1.02] transition-all">
          <div className="absolute right-[-20px] top-[-20px] opacity-10 scale-[2] rotate-12 group-hover:rotate-45 transition-transform duration-700"><Icons.Logo size="w-48 h-48" /></div>
          <div className="text-5xl bg-white/20 w-20 h-20 rounded-3xl flex items-center justify-center backdrop-blur-xl mb-8 shadow-sm">🤖</div>
          <h2 className="text-3xl font-black text-white">AI Companion</h2>
          <p className="text-white/70 text-lg font-medium mt-4 leading-relaxed">Instant, private empathetic listening powered by Gemini.</p>
       </button>
       <button onClick={() => {}} className="group h-80 bg-gradient-to-br from-emerald-500 to-teal-400 p-12 rounded-[60px] text-left relative overflow-hidden shadow-2xl hover:scale-[1.02] transition-all">
          <div className="absolute right-[-20px] top-[-20px] opacity-10 scale-[2] rotate-[-12deg] group-hover:rotate-0 transition-transform duration-700"><div className="text-white text-9xl">🤝</div></div>
          <div className="text-5xl bg-white/20 w-20 h-20 rounded-3xl flex items-center justify-center backdrop-blur-xl mb-8 shadow-sm">🤝</div>
          <h2 className="text-3xl font-black text-white">Peer Support</h2>
          <p className="text-white/70 text-lg font-medium mt-4 leading-relaxed">Connect with a verified community member for mutual support.</p>
       </button>
    </div>
  </div>
);

const AICallScreen = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white items-center justify-center p-10">
       <div className="text-center space-y-6 mb-20 animate-in fade-in duration-1000">
          <h2 className="text-5xl font-black tracking-tight">AI Sanctuary</h2>
          <div className="inline-flex items-center px-8 py-3 bg-indigo-600/20 text-indigo-400 rounded-full text-sm font-black uppercase tracking-[0.3em] border border-indigo-600/30">
            Secure Connection
          </div>
       </div>
       <div className="relative flex items-center justify-center mb-24">
          <div className="absolute w-64 h-64 bg-indigo-500/20 rounded-full animate-ping"></div>
          <div className="absolute w-96 h-96 bg-blue-500/10 rounded-full animate-pulse [animation-duration:3s]"></div>
          <Icons.Logo size="w-56 h-56" />
       </div>
       <div className="flex space-x-16">
          <button className="w-24 h-24 rounded-[40px] flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all active:scale-90"><span className="text-4xl">🎙️</span></button>
          <button className="w-24 h-24 rounded-[40px] bg-red-600 flex items-center justify-center shadow-2xl shadow-red-900/50 hover:bg-red-700 active:scale-90 transition-all"><Icons.Call className="w-12 h-12 text-white rotate-[135deg]" /></button>
       </div>
    </div>
  );
}

const Profile = () => (
  <div className="max-w-3xl mx-auto p-10 space-y-12 pb-32 md:pb-10">
    <div className="flex flex-col items-center pt-10">
      <div className="w-48 h-48 rounded-[64px] border-[12px] border-white p-3 mb-8 relative shadow-2xl bg-gray-50">
        <img src="https://picsum.photos/400/400?random=2" className="w-full h-full rounded-[56px] object-cover" />
        <div className="absolute bottom-[-15px] right-[-15px] bg-emerald-500 text-white w-14 h-14 rounded-3xl flex items-center justify-center border-8 border-white shadow-xl text-2xl font-black">
           ✨
        </div>
      </div>
      <h2 className="text-4xl font-black text-gray-900 tracking-tight">Alex Johnson</h2>
      <p className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] mt-4">Active Member since Oct 2024</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-10">
      {['Account Security', 'Data Privacy', 'Theme Settings', 'Support Center', 'Subscription', 'Integrations'].map(i => (
        <button key={i} className="text-left p-8 bg-white border border-gray-100 rounded-[40px] font-black text-gray-800 hover:bg-gray-50 hover:translate-y-[-2px] transition-all card-shadow">{i}</button>
      ))}
      <button className="md:col-span-2 p-8 text-red-500 font-black text-xl bg-red-50 hover:bg-red-100 rounded-[40px] transition-all mt-8">SIGN OUT</button>
    </div>
  </div>
);

export default App;
