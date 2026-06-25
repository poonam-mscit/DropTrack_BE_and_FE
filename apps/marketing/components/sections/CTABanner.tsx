import { MessageCircle } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { whatsappLink } from '@/lib/site';

export function CTABanner() {
  return (
    <section className="mx-auto max-w-[1100px] px-5 mt-32 mb-8">
      <Reveal>
        <div
          className="glass-strong rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
          style={{
            background:
              'radial-gradient(700px circle at 0% 0%, rgba(99,102,241,0.25), transparent 55%), radial-gradient(600px circle at 100% 100%, rgba(168,85,247,0.22), transparent 55%), rgba(255,255,255,0.04)',
          }}
        >
          <h2 className="font-display text-4xl md:text-5xl text-white tracking-tight">
            See DropTrack in <span className="gradient-text">15 minutes.</span>
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto">
            Walk through a live campaign with our team. We'll quote your suburb on the call.
          </p>
          <div className="mt-7">
            <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
              <MessageCircle size={14} /> Message us on WhatsApp
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
