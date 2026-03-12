/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icons } from './components/Icons';

// --- Types ---
type View = 'landing' | 'dashboard' | 'apps' | 'diagnosis' | 'waiting' | 'customers' | 'reservations' | 'schedule' | 'survey' | 'brand' | 'sales' | 'order' | 'contract';

// --- Components ---

const LiveCounter = ({ start, end, duration = 2 }: { start: number, end: number, duration?: number }) => {
  const [count, setCount] = useState(start);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [start, end, duration]);

  return <span>{count.toLocaleString()}</span>;
};

const Navbar = ({ currentView, setView }: { currentView: View, setView: (v: View) => void }) => (
  <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ec5b13] text-white shadow-lg shadow-orange-500/20">
          <Icons.Chart size={24} />
        </div>
        <h2 className="text-xl font-black tracking-tight text-slate-900">My Biz Lab</h2>
      </div>
      
      <nav className="hidden md:flex flex-1 justify-center gap-10">
        <button onClick={() => setView('landing')} className={`text-sm font-semibold transition-colors ${currentView === 'landing' ? 'text-[#ec5b13]' : 'hover:text-[#ec5b13]'}`}>서비스 소개</button>
        <button onClick={() => setView('apps')} className={`text-sm font-semibold transition-colors ${currentView === 'apps' ? 'text-[#ec5b13]' : 'hover:text-[#ec5b13]'}`}>앱 둘러보기</button>
        <button onClick={() => setView('dashboard')} className={`text-sm font-semibold transition-colors ${currentView === 'dashboard' ? 'text-[#ec5b13]' : 'hover:text-[#ec5b13]'}`}>대시보드</button>
        <button onClick={() => setView('diagnosis')} className={`text-sm font-semibold transition-colors ${currentView === 'diagnosis' ? 'text-[#ec5b13]' : 'hover:text-[#ec5b13]'}`}>비즈니스 진단</button>
      </nav>

      <div className="flex items-center gap-3">
        <button className="hidden sm:block px-5 py-2 text-sm font-bold text-slate-700 hover:text-[#ec5b13] transition-colors">로그인</button>
        <button 
          onClick={() => setView('dashboard')}
          className="rounded-xl bg-[#ec5b13] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:scale-105 transition-all active:scale-95"
        >
          무료로 시작하기
        </button>
      </div>
    </div>
  </header>
);

const LandingPage = ({ setView }: { setView: (v: View) => void }) => (
  <div className="flex flex-col">
    {/* Hero Section */}
    <section className="relative overflow-hidden pt-20 pb-32 md:pt-32 md:pb-48 bg-gradient-to-b from-white via-[#fcfaf9] to-[#f8f6f6]">
      {/* Floating Background Elements */}
      <div className="absolute top-20 left-10 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-orange-500/[0.02] blur-3xl"></div>

      <div className="mx-auto max-w-7xl px-6 relative z-10">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col gap-10"
          >
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-500/10 px-5 py-2 text-sm font-black text-[#ec5b13] border border-orange-500/20 shadow-sm">
              <Icons.Zap size={16} className="fill-current animate-bounce" />
              <span>AI 기반 비즈니스 케어 솔루션 v2.0</span>
            </div>
            <div className="flex flex-col gap-6">
              <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
                AI 점장이 제안하는 <br/>
                <span className="text-[#ec5b13] relative inline-block">
                  매출 성장
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 1, duration: 0.8 }}
                    className="absolute -bottom-2 left-0 h-3 bg-orange-500/20 -z-10"
                  />
                </span> 솔루션
              </h1>
              <p className="max-w-[580px] text-xl leading-relaxed text-slate-600 font-medium">
                데이터 분석부터 고객 관리까지, 인공지능이 사장님의 비즈니스를 24시간 케어합니다. 복잡한 경영은 AI에게 맡기고 사장님은 본질에 집중하세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-5">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('dashboard')}
                className="flex items-center justify-center rounded-2xl bg-[#ec5b13] px-10 py-5 text-xl font-black text-white shadow-2xl shadow-orange-500/40 hover:bg-orange-600 transition-all"
              >
                무료로 시작하기
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.02)' }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-transparent px-10 py-5 text-xl font-black hover:border-[#ec5b13] transition-all"
              >
                서비스 둘러보기
              </motion.button>
            </div>
            <div className="flex items-center gap-6 pt-6">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + (i * 0.1) }}
                    className="h-12 w-12 rounded-full border-4 border-white bg-slate-200 overflow-hidden shadow-md"
                  >
                    <img src={`https://picsum.photos/seed/user${i+10}/100/100`} alt="User" referrerPolicy="no-referrer" />
                  </motion.div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => <Icons.Zap key={i} size={14} className="text-orange-400 fill-current" />)}
                </div>
                <p className="text-sm font-bold text-slate-600">
                  이미 <span className="text-slate-900">12,400+ 명</span>의 사장님이 선택하셨습니다.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="relative perspective-1000"
          >
            <div className="relative z-10 overflow-hidden rounded-[3rem] bg-white p-8 shadow-[0_50px_100px_-20px_rgba(236,91,19,0.15)] border border-slate-100">
              <div className="aspect-[4/3.5] w-full bg-slate-50 rounded-[2.5rem] flex flex-col overflow-hidden p-10 gap-8">
                {/* Dynamic Header */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-[#ec5b13] flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                      <Icons.AI size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">실시간 매장 분석</p>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[8px] font-black">
                          <div className="h-1 w-1 rounded-full bg-emerald-500 animate-ping"></div>
                          LIVE
                        </div>
                      </div>
                      <p className="text-lg font-black text-slate-900">My Biz Lab AI Manager</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map(i => <div key={i} className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
                  </div>
                </div>

                {/* Animated Stats Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <motion.div 
                    whileHover={{ y: -5 }}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
                  >
                    <p className="text-xs font-bold text-slate-400 mb-2">현재 방문객</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-black text-slate-900">
                        <LiveCounter start={10} end={24} />
                      </span>
                      <span className="text-xs font-bold text-emerald-500 mb-1.5">+12%</span>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '70%' }}
                        transition={{ duration: 2, delay: 1 }}
                        className="h-full bg-gradient-to-r from-orange-400 to-[#ec5b13]"
                      />
                    </div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ y: -5 }}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
                  >
                    <p className="text-xs font-bold text-slate-400 mb-2">예상 일매출</p>
                    <div className="flex items-end gap-2 text-[#ec5b13]">
                      <span className="text-3xl font-black">
                        <LiveCounter start={800} end={1250} duration={3} />
                      </span>
                      <span className="text-xs font-bold mb-1.5 tracking-tighter">K KRW</span>
                    </div>
                    <div className="mt-4 flex gap-1.5 items-end h-6">
                      {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8].map((h, i) => (
                        <motion.div 
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${h * 100}%` }}
                          transition={{ 
                            duration: 1, 
                            delay: 1.2 + (i * 0.1),
                            repeat: Infinity,
                            repeatType: 'reverse',
                            repeatDelay: 1.5
                          }}
                          className="flex-1 bg-orange-100 rounded-t-md"
                        />
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Main Dynamic Chart */}
                <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-slate-900">시간대별 혼잡도 예측</span>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-100"></div>
                        <span className="text-xs font-bold text-slate-400">평균</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#ec5b13]"></div>
                        <span className="text-xs font-bold text-slate-400">오늘</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-end justify-between gap-3 px-2">
                    {[30, 45, 25, 60, 85, 40, 35, 50, 95, 70, 40, 30].map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="w-full bg-slate-50 rounded-t-lg relative h-32 overflow-hidden">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${val}%` }}
                            transition={{ 
                              duration: 1.5, 
                              delay: 1.5 + (i * 0.05),
                              repeat: Infinity,
                              repeatType: 'reverse',
                              repeatDelay: 4 + (i * 0.2)
                            }}
                            className={`absolute bottom-0 w-full rounded-t-lg ${val > 80 ? 'bg-[#ec5b13]' : 'bg-orange-200'}`}
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-300">{i + 10}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insight Overlay */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.5, type: "spring", stiffness: 100 }}
                  className="bg-slate-900 text-white p-5 rounded-2xl flex items-center gap-5 shadow-2xl"
                >
                  <div className="h-10 w-10 rounded-xl bg-[#ec5b13] flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                    <Icons.Zap size={20} />
                  </div>
                  <p className="text-xs leading-relaxed font-bold">
                    <span className="text-[#ec5b13] font-black">AI Insight:</span> 14시부터 단체 손님 방문이 예상됩니다. <br/>
                    <span className="text-white/60 font-medium">추가 인력을 배치하고 재료를 미리 준비하세요.</span>
                  </p>
                </motion.div>
              </div>
            </div>
            
            {/* Decorative Elements */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-12 -left-12 h-24 w-24 rounded-3xl bg-white shadow-xl flex items-center justify-center text-[#ec5b13] z-20 border border-slate-100"
            >
              <Icons.Growth size={40} />
            </motion.div>
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-8 -right-8 h-20 w-20 rounded-3xl bg-white shadow-xl flex items-center justify-center text-emerald-500 z-20 border border-slate-100"
            >
              <Icons.Check size={32} />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>

    {/* Features Grid */}
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">사장님을 위한 올인원 핵심 기능</h2>
          <p className="mt-4 text-lg text-slate-600">업무 효율을 극대화하는 스마트한 도구들을 경험해보세요.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: <Icons.AI />, title: 'AI 점장', desc: 'AI가 매장 데이터를 분석하여 실시간으로 매출 성장 전략을 제안합니다.' },
            { icon: <Icons.Users />, title: '고객 관리', desc: '재방문 패턴 분석부터 고객별 맞춤 프로모션까지 한 번에 관리하세요.' },
            { icon: <Icons.Calendar />, title: '스마트 예약', desc: '노쇼 방지를 위한 예약 시스템과 자동 알림톡 기능을 지원합니다.' },
            { icon: <Icons.Clock />, title: '일정 관리', desc: '직원 근무 일정과 매장 운영 스케줄을 직관적으로 확인하세요.' },
            { icon: <Icons.Survey />, title: '설문 조사', desc: '실제 방문 고객의 생생한 피드백을 수집하고 서비스 품질을 개선하세요.' },
            { icon: <Icons.Brand />, title: '브랜드 관리', desc: '온라인 리뷰 대응부터 브랜드 일관성 유지까지 AI가 도와드립니다.' },
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -5 }}
              className="group rounded-2xl border border-slate-100 bg-[#f8f6f6] p-8 hover:border-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/5"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-[#ec5b13] group-hover:bg-[#ec5b13] group-hover:text-white transition-colors">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Prediction Section */}
    <section className="py-24 bg-[#f8f6f6]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-[2.5rem] bg-[#ec5b13] px-8 py-16 text-white md:px-16 lg:flex lg:items-center lg:gap-16 shadow-2xl shadow-orange-500/20">
          <div className="lg:flex-1">
            <div className="mb-6 inline-flex rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold backdrop-blur-sm">
              AI 기반 정밀 분석
            </div>
            <h2 className="mb-6 text-3xl font-black leading-tight sm:text-4xl">내일의 매출을 <br className="md:hidden"/>미리 예측합니다</h2>
            <p className="mb-10 text-lg text-white/80 leading-relaxed">
              단순한 과거 데이터 요약이 아닙니다. My Biz Lab의 AI는 외부 날씨, 요일, 지역 행사 데이터까지 결합하여 정교한 미래 예측 시나리오를 제공합니다.
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icons.Growth size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">예측 인사이트</h4>
                  <p className="text-sm text-white/70">익일 예상 매출 정확도 94.8% 달성</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icons.Check size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">행동 제안</h4>
                  <p className="text-sm text-white/70">지금 즉시 실행 가능한 마케팅 솔루션</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 lg:mt-0 lg:w-1/3">
            <div className="relative rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/20 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icons.Chart size={18} />
                  <span className="text-sm font-bold uppercase tracking-wider">AI 분석 결과</span>
                </div>
                <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold">실시간 업데이트</span>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl bg-white/10 p-4 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">내일의 예상 고객 수</p>
                  <p className="text-xl font-bold">평소보다 15% 높음</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">AI 추천 메뉴</p>
                  <p className="text-xl font-bold">매콤 제육 덮밥</p>
                  <p className="mt-2 text-[10px] text-white/50 leading-tight">내일 강수 확률이 높아 선호도가 상승할 것으로 예상됩니다.</p>
                </div>
                <button className="w-full rounded-xl bg-white px-4 py-3.5 text-[#ec5b13] font-black text-sm flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <span>프로모션 실행하기</span>
                  <Icons.ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const Dashboard = () => (
  <div className="flex-1 flex flex-col p-6 lg:p-8 max-w-7xl mx-auto w-full gap-8">
    {/* Header Stats */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[
        { label: '현재 방문객', value: '24명', trend: '+15%', icon: <Icons.Users />, color: 'blue' },
        { label: '예상 일매출', value: '1,250,000원', trend: '-5%', icon: <Icons.Growth />, color: 'orange' },
        { label: '운영 효율', value: '92%', trend: '최적', icon: <Icons.Zap />, color: 'emerald' },
        { label: 'AI 점수', value: '88점', trend: '상위 10%', icon: <Icons.AI />, color: 'purple' },
      ].map((stat, idx) => (
        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <div className={`text-${stat.color}-500`}>{stat.icon}</div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
            <span>{stat.trend}</span>
          </div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Chart Card */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900">피크타임 예측 및 분석</h3>
            <p className="text-sm text-slate-500">향후 6시간 동안의 매장 혼잡도 예측</p>
          </div>
          <span className="bg-orange-50 text-[#ec5b13] px-3 py-1 rounded-full text-xs font-bold">실시간 업데이트</span>
        </div>
        <div className="h-64 flex items-end justify-between gap-3 px-2">
          {[40, 60, 95, 80, 50, 30].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-3">
              <div className="w-full bg-slate-50 rounded-t-xl relative group overflow-hidden" style={{ height: `${h}%` }}>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: '100%' }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`absolute bottom-0 w-full rounded-t-xl ${h > 80 ? 'bg-[#ec5b13]' : 'bg-orange-200'}`}
                />
              </div>
              <span className={`text-[10px] font-bold ${h > 80 ? 'text-[#ec5b13]' : 'text-slate-400'}`}>{12 + i}:00</span>
            </div>
          ))}
        </div>
        <div className="mt-8 p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-start gap-3">
          <Icons.Alert size={20} className="text-[#ec5b13] shrink-0" />
          <p className="text-sm leading-relaxed text-slate-700">
            <span className="font-bold text-[#ec5b13]">AI 분석:</span> 오늘 오후 2시부터 3시 사이에 단체 고객 방문 확률이 78%로 높습니다. 추가 인력 배치를 권장합니다.
          </p>
        </div>
      </div>

      {/* Side Panels */}
      <div className="flex flex-col gap-8">
        <div className="bg-[#ec5b13] text-white rounded-2xl p-6 shadow-xl shadow-orange-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Icons.Zap size={20} />
            <h3 className="font-bold">매출 향상 팁</h3>
          </div>
          <p className="text-sm opacity-90 mb-6 leading-relaxed">
            "현재 날씨가 흐려짐에 따라 '따뜻한 라떼' 메뉴의 주문율이 상승하고 있습니다. 키오스크 메인에 추천 메뉴로 노출해보세요."
          </p>
          <button className="w-full py-3 bg-white text-[#ec5b13] rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
            지금 바로 적용하기
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold mb-6 flex items-center gap-2">
            <Icons.AI size={18} className="text-[#ec5b13]" />
            오늘의 AI 제안 리스트
          </h3>
          <div className="space-y-4">
            {[
              { title: '에어컨 온도 1도 낮추기', sub: '방문객 급증으로 실내 온도 상승 중' },
              { title: '브런치 세트 할인 종료', sub: '목표 판매량 달성 완료' },
              { title: 'BGM 템포 올리기', sub: '피크타임 대비 회전율 향상 유도' },
            ].map((item, idx) => (
              <label key={idx} className="flex items-center gap-3 p-4 rounded-xl border border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="checkbox" className="rounded border-slate-300 text-[#ec5b13] focus:ring-[#ec5b13]" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="text-[10px] text-slate-500">{item.sub}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AppExplorer = ({ setView }: { setView: (v: View) => void }) => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full">
    <div className="mb-12 space-y-3">
      <h1 className="text-4xl font-black tracking-tight text-slate-900">앱 둘러보기</h1>
      <p className="text-slate-500 text-lg">비즈니스 성장을 위한 My Biz Lab의 전문 서비스 모듈을 한눈에 확인하세요.</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[
        { icon: <Icons.AI />, title: 'AI 점장', desc: 'AI 기반 매장 운영 데이터 분석 및 맞춤형 가이드 제공으로 효율을 극대화합니다.', target: 'dashboard' as View },
        { icon: <Icons.Chart />, title: 'AI 비즈니스 리포트', desc: '성장 가능성 점수와 강점/약점 분석을 포함한 심층 리포트를 제공합니다.', target: 'diagnosis' as View },
        { icon: <Icons.Users />, title: '고객 관리', desc: '방문 고객 데이터를 체계적으로 관리하고 재방문을 유도하는 타겟 마케팅을 지원합니다.', target: 'customers' as View },
        { icon: <Icons.Calendar />, title: '예약 관리', desc: '실시간 온라인 예약 현황을 관리하고 노쇼 방지를 위한 자동 알림을 발송합니다.', target: 'reservations' as View },
        { icon: <Icons.Clock />, title: '일정 관리', desc: '직원별 근무 스케줄과 주요 매장 일정을 직관적인 캘린더로 관리하세요.', target: 'schedule' as View },
        { icon: <Icons.Survey />, title: '설문 조사', desc: '고객의 목소리를 직접 듣고 서비스 개선을 위한 인사이트를 확보할 수 있습니다.', target: 'survey' as View },
        { icon: <Icons.Brand />, title: '브랜드 관리', desc: '브랜드 로고, 이미지, 디자인 가이드를 한곳에서 관리하고 일관성을 유지합니다.', target: 'brand' as View },
        { icon: <Icons.Chart />, title: '매출 분석', desc: '일간, 주간, 월간 매출 성과를 다양한 지표로 시각화하여 분석 보고서를 제공합니다.', target: 'sales' as View },
        { icon: <Icons.Delivery />, title: '주문 관리', desc: '매장 내 주문과 배달 앱 주문을 통합하여 효율적으로 관리하고 처리할 수 있습니다.', target: 'order' as View },
        { icon: <Icons.Waiting />, title: '웨이팅보드', desc: '현장 대기 고객 등록 및 카카오톡 알림톡 자동 발송으로 대기 경험을 개선합니다.', target: 'waiting' as View },
        { icon: <Icons.Contract />, title: '전자계약', desc: '번거로운 종이 계약 대신 법적 효력이 있는 간편한 모바일 전자계약을 이용하세요.', target: 'contract' as View },
      ].map((app, idx) => (
        <div key={idx} className="group flex flex-col bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-2xl hover:border-orange-500/30 transition-all">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-[#ec5b13] group-hover:bg-[#ec5b13] group-hover:text-white transition-colors">
            {app.icon}
          </div>
          <h3 className="text-xl font-bold mb-2">{app.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-8 flex-1">{app.desc}</p>
          <button 
            onClick={() => setView(app.target)}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-slate-50 text-slate-900 font-bold hover:bg-[#ec5b13] hover:text-white transition-all"
          >
            바로가기
            <Icons.ArrowRight size={16} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

const Diagnosis = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-[#ec5b13]">
          <Icons.AI size={12} />
          <span>AI 비즈니스 리포트</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">비즈니스 진단 결과</h1>
        <p className="text-slate-500 text-lg">사장님의 매장은 현재 <span className="text-[#ec5b13] font-bold">성장 가속 단계</span>에 있습니다.</p>
      </div>
      <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#ec5b13] text-white font-bold shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
        <Icons.Contract size={18} />
        PDF 리포트 다운로드
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Score Card */}
      <div className="lg:col-span-1 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
        <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-8">성장 가능성 점수</h3>
        <div className="relative h-48 w-48 flex items-center justify-center mb-8">
          <svg className="h-full w-full -rotate-90">
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-50" />
            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={552.92} strokeDashoffset={552.92 * (1 - 0.82)} className="text-[#ec5b13]" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-slate-900">82</span>
            <span className="text-sm font-bold text-slate-400">/ 100</span>
          </div>
        </div>
        <p className="text-slate-600 leading-relaxed">
          동종 업계 상위 <span className="font-bold text-slate-900">12%</span> 수준입니다. <br/>
          지난 달 대비 <span className="text-emerald-500 font-bold">4점 상승</span>했습니다.
        </p>
      </div>

      {/* Analysis Grid */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <Icons.Check size={20} />
            <h4 className="font-bold">강점 (Strengths)</h4>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
              <span>높은 재방문율 (평균 대비 1.5배)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
              <span>주말 피크타임 효율적 운영</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
              <span>긍정적인 온라인 리뷰 평점 (4.8/5.0)</span>
            </li>
          </ul>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-orange-500">
            <Icons.Alert size={20} />
            <h4 className="font-bold">약점 (Weaknesses)</h4>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></span>
              <span>평일 오후 3-5시 매출 저조</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></span>
              <span>신규 고객 유입 경로 불분명</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></span>
              <span>원자재 가격 변동에 따른 마진율 하락</span>
            </li>
          </ul>
        </div>
        <div className="md:col-span-2 bg-slate-900 text-white rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-[#ec5b13]">
              <Icons.AI size={24} />
            </div>
            <h4 className="text-xl font-bold">AI 추천 액션 플랜</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { title: '타임 세일 도입', desc: '평일 15~17시 한정 20% 할인 프로모션' },
              { title: 'SNS 광고 집행', desc: '인근 지역 2030 타겟 인스타그램 광고' },
              { title: '메뉴 리뉴얼', desc: '고마진 사이드 메뉴 2종 추가 구성' },
            ].map((plan, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="font-bold text-orange-400 mb-2">Step 0{i+1}</p>
                <p className="font-bold mb-1">{plan.title}</p>
                <p className="text-xs text-white/50 leading-relaxed">{plan.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const WaitingBoard = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Waiting size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">웨이팅보드</h1>
        <p className="text-slate-500">현재 대기 중인 고객 리스트입니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold">대기 리스트 (4명)</h3>
          <button className="px-4 py-2 bg-[#ec5b13] text-white rounded-xl text-sm font-bold">대기 등록</button>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { name: '김*수', phone: '010-****-1234', count: 2, time: '10분 전', status: '대기중' },
            { name: '이*희', phone: '010-****-5678', count: 4, time: '15분 전', status: '대기중' },
            { name: '박*민', phone: '010-****-9012', count: 1, time: '22분 전', status: '호출완료' },
            { name: '최*영', phone: '010-****-3456', count: 3, time: '30분 전', status: '입장완료' },
          ].map((item, i) => (
            <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">{i+1}</div>
                <div>
                  <p className="font-bold text-slate-900">{item.name} <span className="text-xs font-normal text-slate-400 ml-2">{item.phone}</span></p>
                  <p className="text-xs text-slate-500">{item.count}명 · {item.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                  item.status === '대기중' ? 'bg-orange-100 text-[#ec5b13]' : 
                  item.status === '호출완료' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {item.status}
                </span>
                <button className="p-2 text-slate-400 hover:text-[#ec5b13] transition-colors">
                  <Icons.ArrowRight size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl">
          <h3 className="text-lg font-bold mb-6">AI 대기 예측</h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-white/50 mb-2">현재 평균 대기 시간</p>
              <p className="text-3xl font-black text-[#ec5b13]">18분</p>
            </div>
            <div className="h-px bg-white/10"></div>
            <p className="text-sm text-white/70 leading-relaxed">
              "현재 회전율을 고려할 때, 20분 내로 3팀이 입장 가능할 것으로 예측됩니다. 대기 고객에게 미리 메뉴판을 전달해보세요."
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CustomerManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Users size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">고객 관리</h1>
        <p className="text-slate-500">우리 매장의 소중한 고객 데이터입니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold mb-4">고객 분류</h3>
          <div className="space-y-2">
            {[
              { label: '전체 고객', count: 1240, color: 'bg-slate-100' },
              { label: '단골 고객', count: 320, color: 'bg-orange-100 text-[#ec5b13]' },
              { label: '신규 고객', count: 85, color: 'bg-emerald-100 text-emerald-600' },
              { label: '이탈 위험', count: 42, color: 'bg-red-100 text-red-600' },
            ].map((cat, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <span className="text-sm font-medium">{cat.label}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${cat.color}`}>{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <div className="relative flex-1 max-w-xs">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="고객명 또는 연락처 검색" className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
          </div>
          <button className="px-4 py-2 text-[#ec5b13] font-bold text-sm">필터 설정</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4">고객명</th>
              <th className="px-6 py-4">방문 횟수</th>
              <th className="px-6 py-4">최근 방문일</th>
              <th className="px-6 py-4">누적 결제액</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[
              { name: '김철수', visits: 12, last: '2024.03.10', total: '450,000원' },
              { name: '이영희', visits: 8, last: '2024.03.08', total: '280,000원' },
              { name: '박지민', visits: 24, last: '2024.03.11', total: '1,200,000원' },
              { name: '최유진', visits: 2, last: '2024.02.28', total: '45,000원' },
            ].map((user, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-sm">{user.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.visits}회</td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.last}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900">{user.total}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-[#ec5b13]"><Icons.Message size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const ReservationManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Calendar size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">예약 관리</h1>
        <p className="text-slate-500">오늘의 예약 현황을 확인하세요.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold">2024년 3월 12일 (목)</h3>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100"><Icons.ArrowRight className="rotate-180" size={16} /></button>
              <button className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100"><Icons.ArrowRight size={16} /></button>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { time: '12:00', name: '김*수', count: 4, status: '확정' },
              { time: '13:30', name: '이*희', count: 2, status: '대기' },
              { time: '18:00', name: '박*민', count: 6, status: '확정' },
              { time: '19:00', name: '최*영', count: 2, status: '확정' },
            ].map((res, i) => (
              <div key={i} className="flex items-center gap-6 p-4 rounded-2xl border border-slate-50 hover:border-orange-200 transition-all">
                <div className="w-16 text-center">
                  <p className="text-lg font-black text-slate-900">{res.time}</p>
                </div>
                <div className="flex-1">
                  <p className="font-bold">{res.name} 사장님 외 {res.count-1}명</p>
                  <p className="text-xs text-slate-400">인원: {res.count}명 · 테이블: 창가석</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${res.status === '확정' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-[#ec5b13]'}`}>
                  {res.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h3 className="font-bold mb-6">예약 통계</h3>
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400 mb-1">오늘 총 예약</p>
                <p className="text-2xl font-black text-slate-900">12건</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-500 font-bold">+3건</p>
                <p className="text-[10px] text-slate-300">어제 대비</p>
              </div>
            </div>
            <div className="h-px bg-slate-50"></div>
            <div>
              <p className="text-xs text-slate-400 mb-4">시간대별 예약 분포</p>
              <div className="flex items-end gap-2 h-20">
                {[20, 40, 80, 60, 30, 90, 50].map((h, i) => (
                  <div key={i} className="flex-1 bg-slate-50 rounded-t-sm relative">
                    <div className="absolute bottom-0 w-full bg-orange-100 rounded-t-sm" style={{ height: `${h}%` }}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ScheduleManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Clock size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">일정 관리</h1>
        <p className="text-slate-500">직원 근무 일정과 매장 스케줄을 관리합니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold">이번 주 근무표</h3>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-bold">주간</button>
            <button className="px-4 py-2 rounded-xl bg-[#ec5b13] text-white text-sm font-bold">월간</button>
          </div>
        </div>
        <div className="grid grid-cols-8 gap-2">
          <div className="h-12"></div>
          {['월', '화', '수', '목', '금', '토', '일'].map(d => (
            <div key={d} className="h-12 flex items-center justify-center font-bold text-slate-400 text-sm">{d}</div>
          ))}
          {['오전', '오후', '야간'].map(shift => (
            <React.Fragment key={shift}>
              <div className="h-20 flex items-center justify-center font-bold text-slate-500 text-xs bg-slate-50 rounded-xl">{shift}</div>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-20 border border-slate-50 rounded-xl p-2 flex flex-col gap-1">
                  <div className="h-full w-full bg-orange-50 rounded-lg border border-orange-100 p-1">
                    <p className="text-[10px] font-bold text-[#ec5b13]">김철수</p>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
          <h3 className="font-bold mb-4">오늘의 주요 일정</h3>
          <div className="space-y-4">
            {[
              { time: '14:00', title: '식자재 납품', desc: '신선 채소 및 육류' },
              { time: '16:30', title: '주간 회의', desc: '서비스 개선 논의' },
              { time: '22:00', title: '정기 방역', desc: '매장 전체 소독' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="text-[#ec5b13] font-bold text-xs pt-1">{item.time}</div>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="text-[10px] text-white/50">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SurveyManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Survey size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">설문 조사</h1>
        <p className="text-slate-500">고객의 생생한 목소리를 분석합니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
        <p className="text-sm font-bold text-slate-400 mb-2">이번 달 고객 만족도 (NPS)</p>
        <p className="text-6xl font-black text-[#ec5b13] mb-4">72</p>
        <p className="text-sm text-emerald-500 font-bold">지난 달 대비 +5점 상승</p>
      </div>
      <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h3 className="font-bold mb-6">최근 피드백 키워드</h3>
        <div className="flex flex-wrap gap-3">
          {['친절한 서비스', '맛있는 음식', '깔끔한 인테리어', '가성비 최고', '주차 편리', '대기 시간 김'].map(tag => (
            <span key={tag} className="px-4 py-2 rounded-full bg-slate-50 text-slate-600 text-sm font-medium border border-slate-100">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-bold">상세 설문 결과</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { user: '김*수', score: 5, comment: '음식이 정말 맛있고 직원분들이 친절해요!', date: '1시간 전' },
            { user: '이*희', score: 4, comment: '분위기가 너무 좋아서 데이트하기 딱이네요.', date: '3시간 전' },
            { user: '박*민', score: 3, comment: '맛은 좋은데 대기 시간이 조금 길어서 아쉬웠어요.', date: '5시간 전' },
          ].map((survey, i) => (
            <div key={i} className="p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">{survey.user[0]}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-bold text-sm">{survey.user}</p>
                  <span className="text-[10px] text-slate-400">{survey.date}</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Icons.Zap key={j} size={12} className={j < survey.score ? 'text-orange-400 fill-current' : 'text-slate-200'} />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{survey.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const BrandManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Brand size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">브랜드 관리</h1>
        <p className="text-slate-500">매장의 브랜드 아이덴티티를 통합 관리합니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 space-y-6">
        <h3 className="font-bold">브랜드 로고</h3>
        <div className="aspect-square rounded-2xl bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200">
          <div className="text-center">
            <Icons.Chart size={48} className="mx-auto text-[#ec5b13] mb-2" />
            <p className="text-xs font-bold text-slate-400">My Biz Lab Logo</p>
          </div>
        </div>
        <button className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm">로고 변경하기</button>
      </div>
      <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h3 className="font-bold mb-6">브랜드 컬러 가이드</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: 'Primary', hex: '#ec5b13', desc: '메인 브랜드 컬러' },
            { name: 'Secondary', hex: '#1e293b', desc: '서브 텍스트 컬러' },
            { name: 'Accent', hex: '#f97316', desc: '강조 포인트 컬러' },
            { name: 'Background', hex: '#f8fafc', desc: '배경 기본 컬러' },
          ].map(color => (
            <div key={color.name} className="space-y-3">
              <div className="h-20 rounded-xl shadow-inner border border-slate-100" style={{ backgroundColor: color.hex }}></div>
              <div>
                <p className="text-xs font-bold text-slate-900">{color.name}</p>
                <p className="text-[10px] text-slate-400">{color.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-3 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h3 className="font-bold mb-6">온라인 채널 프로필</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {['네이버 플레이스', '인스타그램', '카카오톡 채널'].map(channel => (
            <div key={channel} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-slate-400">
                  <Icons.Globe size={20} />
                </div>
                <span className="font-bold text-sm">{channel}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500">연결됨</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SalesAnalysis = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Growth size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">매출 분석</h1>
        <p className="text-slate-500">데이터로 보는 우리 매장의 성장 지표입니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">이번 달 총 매출</p>
        <p className="text-3xl font-black text-slate-900">32,450,000원</p>
        <p className="mt-2 text-sm text-emerald-500 font-bold">전월 대비 +12.5%</p>
      </div>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">평균 객단가</p>
        <p className="text-3xl font-black text-slate-900">24,500원</p>
        <p className="mt-2 text-sm text-orange-500 font-bold">전월 대비 -2.1%</p>
      </div>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">결제 건수</p>
        <p className="text-3xl font-black text-slate-900">1,324건</p>
        <p className="mt-2 text-sm text-emerald-500 font-bold">전월 대비 +8.4%</p>
      </div>
      <div className="md:col-span-3 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-bold">월간 매출 추이</h3>
          <select className="bg-slate-50 border-none rounded-xl text-xs font-bold px-4 py-2">
            <option>최근 6개월</option>
            <option>최근 1년</option>
          </select>
        </div>
        <div className="h-64 flex items-end justify-between gap-4">
          {[40, 55, 45, 70, 85, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-3">
              <div className="w-full bg-slate-50 rounded-t-xl relative h-full overflow-hidden">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className="absolute bottom-0 w-full bg-[#ec5b13] rounded-t-xl"
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400">{i + 10}월</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const OrderManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Delivery size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">주문 관리</h1>
        <p className="text-slate-500">매장 및 배달 주문을 통합 관리합니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex gap-4">
          <button className="px-6 py-3 rounded-2xl bg-[#ec5b13] text-white font-bold text-sm shadow-lg shadow-orange-500/20">진행 중 (3)</button>
          <button className="px-6 py-3 rounded-2xl bg-white text-slate-500 font-bold text-sm border border-slate-100">완료 (42)</button>
          <button className="px-6 py-3 rounded-2xl bg-white text-slate-500 font-bold text-sm border border-slate-100">취소 (1)</button>
        </div>
        <div className="space-y-4">
          {[
            { id: 'ORD-2024-001', type: '매장', menu: '아메리카노 외 2건', price: '15,500원', time: '5분 전', status: '조리 중' },
            { id: 'ORD-2024-002', type: '배달', menu: '카페라떼 2잔', price: '11,000원', time: '12분 전', status: '배달 준비' },
            { id: 'ORD-2024-003', type: '매장', menu: '샌드위치 세트', price: '9,800원', time: '15분 전', status: '조리 중' },
          ].map((order, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-xs ${order.type === '매장' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {order.type}
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">{order.id}</p>
                  <p className="font-bold text-slate-900">{order.menu}</p>
                  <p className="text-xs text-slate-500">{order.price} · {order.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 rounded-full bg-orange-100 text-[#ec5b13] text-[10px] font-bold">{order.status}</span>
                <button className="p-2 text-slate-400 hover:text-[#ec5b13]"><Icons.ArrowRight size={20} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h3 className="font-bold mb-6">주문 요약</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">오늘 총 주문</span>
              <span className="font-bold">46건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">매장 주문</span>
              <span className="font-bold">32건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">배달 주문</span>
              <span className="font-bold">14건</span>
            </div>
            <div className="h-px bg-slate-50 my-4"></div>
            <div className="flex justify-between items-center text-[#ec5b13]">
              <span className="text-sm font-bold">오늘 총 매출</span>
              <span className="text-xl font-black">684,200원</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ContractManagement = () => (
  <div className="flex-1 px-6 py-12 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#ec5b13]">
        <Icons.Contract size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-900">전자계약</h1>
        <p className="text-slate-500">안전하고 간편한 비대면 전자계약 서비스입니다.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-bold">최근 계약 리스트</h3>
            <button className="px-4 py-2 bg-[#ec5b13] text-white rounded-xl text-sm font-bold">새 계약 만들기</button>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { title: '근로계약서 - 김철수', date: '2024.03.10', status: '완료' },
              { title: '임대차계약서 - 본점', date: '2024.03.05', status: '진행중' },
              { title: '비밀유지서약서 - 전직원', date: '2024.02.28', status: '완료' },
            ].map((contract, i) => (
              <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <Icons.Contract size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{contract.title}</p>
                    <p className="text-[10px] text-slate-400">작성일: {contract.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${contract.status === '완료' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-[#ec5b13]'}`}>
                    {contract.status}
                  </span>
                  <button className="p-2 text-slate-400 hover:text-[#ec5b13] transition-colors">
                    <Icons.ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl">
          <h3 className="text-lg font-bold mb-6">계약 템플릿</h3>
          <div className="space-y-4">
            {['표준 근로계약서', '상가 임대차계약서', '개인정보 활용동의서', '물품 공급계약서'].map(template => (
              <button key={template} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors flex justify-between items-center">
                <span className="text-sm font-bold">{template}</span>
                <Icons.ArrowRight size={14} className="text-white/30" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Footer = () => (
  <footer className="mt-auto border-t border-slate-200 bg-white py-16 px-6 lg:px-20">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl bg-orange-500/10 p-2 text-[#ec5b13]">
            <Icons.Chart size={24} />
          </div>
          <span className="text-xl font-black text-slate-900">My Biz Lab</span>
        </div>
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
          인공지능 기술을 통해 소상공인의 비즈니스 성장을 지원하는 든든한 파트너가 되겠습니다.
        </p>
        <div className="flex gap-4">
          {[Icons.Globe, Icons.Mobile, Icons.Message].map((Icon, i) => (
            <a key={i} href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-[#ec5b13] hover:text-white transition-all">
              <Icon size={18} />
            </a>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
        <div className="space-y-6">
          <h4 className="font-bold text-slate-900">제품</h4>
          <ul className="text-sm text-slate-500 space-y-3">
            <li><a className="hover:text-[#ec5b13] transition-colors" href="#">기능 안내</a></li>
            <li><a className="hover:text-[#ec5b13] transition-colors" href="#">가격 정책</a></li>
            <li><a className="hover:text-[#ec5b13] transition-colors" href="#">업데이트 소식</a></li>
          </ul>
        </div>
        <div className="space-y-6">
          <h4 className="font-bold text-slate-900">고객지원</h4>
          <ul className="text-sm text-slate-500 space-y-3">
            <li><a className="hover:text-[#ec5b13] transition-colors" href="#">도움말 센터</a></li>
            <li><a className="hover:text-[#ec5b13] transition-colors" href="#">문의하기</a></li>
            <li><a className="hover:text-[#ec5b13] transition-colors" href="#">이용약관</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-100 text-center text-xs text-slate-400">
      © 2024 My Biz Lab. All rights reserved.
    </div>
  </footer>
);

export default function App() {
  const [view, setView] = useState<View>('landing');

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <div className="min-h-screen flex flex-col font-display selection:bg-orange-100 selection:text-[#ec5b13]">
      <Navbar currentView={view} setView={setView} />
      
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {view === 'landing' && <LandingPage setView={setView} />}
            {view === 'dashboard' && <Dashboard />}
            {view === 'apps' && <AppExplorer setView={setView} />}
            {view === 'diagnosis' && <Diagnosis />}
            {view === 'waiting' && <WaitingBoard />}
            {view === 'customers' && <CustomerManagement />}
            {view === 'reservations' && <ReservationManagement />}
            {view === 'schedule' && <ScheduleManagement />}
            {view === 'survey' && <SurveyManagement />}
            {view === 'brand' && <BrandManagement />}
            {view === 'sales' && <SalesAnalysis />}
            {view === 'order' && <OrderManagement />}
            {view === 'contract' && <ContractManagement />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
