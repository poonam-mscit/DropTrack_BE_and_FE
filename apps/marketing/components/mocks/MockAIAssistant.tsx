'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Plus, Sparkles } from 'lucide-react';
import { MockFrame } from './MockFrame';

const THREADS = [
  { t: 'How did Bondi perform?', n: 4, time: '2h' },
  { t: 'When should I re-run Mosman?', n: 6, time: '1d' },
  { t: 'Hook ideas for clinic flyer', n: 3, time: '3d' },
];

const MESSAGES = [
  { role: 'user', text: 'How did my Bondi campaign go?' },
  {
    role: 'assistant',
    text: `Bondi · Open House (J-2491) hit 98.4% coverage across 5,000 leaflets — strong for inner-Sydney in autumn. Drop pace peaked at 1 PM and Fraud Shield raised zero flags.

Suggested re-run: 3 June 2026 (20 days out — the band Bondi typically responds best in).`,
  },
  { role: 'user', text: 'What if I delayed it by a week?' },
];

export function MockAIAssistant() {
  const reduce = useReducedMotion();

  return (
    <MockFrame title="app.droptrack.com.au/ai-assistant">
      <div className="grid grid-cols-[210px_1fr] h-[480px]">
        {/* Threads sidebar */}
        <aside className="border-r border-[#edeef1] bg-white p-3 flex flex-col gap-2">
          <button
            className="text-white text-[11px] px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 justify-center w-full"
            style={{
              background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)',
              boxShadow: '0 4px 14px -2px rgba(79,70,229,.4), inset 0 1px 0 rgba(255,255,255,.15)',
            }}
          >
            <Plus size={11} /> New conversation
          </button>
          <p className="text-[9px] uppercase tracking-[.18em] text-[#8b92a4] font-bold px-1 mt-2">
            Recent
          </p>
          {THREADS.map((th, i) => (
            <motion.div
              key={th.t}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className={`rounded-lg p-2.5 cursor-pointer ${
                i === 0 ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-[#f3f4f6]'
              }`}
            >
              <p
                className={`text-[11px] font-semibold truncate ${
                  i === 0 ? 'text-[#4f46e5]' : 'text-[#4b5161]'
                }`}
              >
                {th.t}
              </p>
              <p className="text-[9px] text-[#8b92a4] mt-0.5">
                {th.n} messages · {th.time} ago
              </p>
            </motion.div>
          ))}
        </aside>

        {/* Chat area */}
        <div className="flex flex-col bg-[#f8f9fb]">
          <header className="px-5 py-3 border-b border-[#edeef1] bg-white flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a3e635)' }}
            >
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <p className="text-[#0b0d12] font-bold text-sm">AI Assistant</p>
              <p className="text-[10px] text-[#8b92a4]">Claude via AWS Bedrock · Sydney</p>
            </div>
          </header>

          <div className="flex-1 overflow-hidden p-5 space-y-4">
            {MESSAGES.map((m, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.12 * i + 0.2, duration: 0.5 }}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a3e635)' }}
                  >
                    <Sparkles size={12} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'bg-white border border-[#edeef1] text-[#4b5161] rounded-bl-md shadow-[0_2px_6px_rgba(11,13,18,.04)]'
                  }`}
                  style={
                    m.role === 'user'
                      ? { background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)' }
                      : undefined
                  }
                >
                  {m.text}
                </div>
                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-[#0b0d12] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    SN
                  </div>
                )}
              </motion.div>
            ))}

            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="flex gap-2.5"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a3e635)' }}
              >
                <Sparkles size={12} className="text-white" />
              </div>
              <div className="bg-white border border-[#edeef1] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5 shadow-[0_2px_6px_rgba(11,13,18,.04)]">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-1.5 rounded-full bg-[#8b92a4]"
                    animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, delay: d * 0.2, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          <div className="p-3 border-t border-[#edeef1] bg-white">
            <div className="flex items-center gap-2 bg-white border border-[#edeef1] rounded-xl px-3 py-2 shadow-[0_1px_2px_rgba(11,13,18,.04)]">
              <span className="text-[11px] text-[#8b92a4] flex-1">
                Ask anything about your campaigns…
              </span>
              <button
                className="text-white p-1.5 rounded-lg"
                style={{
                  background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)',
                  boxShadow: '0 4px 14px -2px rgba(79,70,229,.4), inset 0 1px 0 rgba(255,255,255,.15)',
                }}
              >
                <ArrowUp size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}
