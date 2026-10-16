import { motion } from 'framer-motion';
import { Instagram, Mail } from 'lucide-react';
import { CURSO } from '../content/curso';
import { HatMark, Wordmark } from '../components/Logo';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line/10 pb-10 pt-16">
      <div className="page">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-3"
            >
              <HatMark className="h-12 w-12" />
              <Wordmark className="text-lg" />
            </motion.div>
            <p className="mt-5 max-w-md font-display text-2xl font-semibold uppercase leading-tight tracking-wide text-ink sm:text-3xl">
              {CURSO.titulo.antes} <span className="gradient-text">{CURSO.titulo.principal}</span> {CURSO.titulo.despues}.
            </p>
          </div>
          <div className="space-y-3 md:justify-self-end">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">Informes</p>
            <a
              href={`mailto:${CURSO.contacto.email}`}
              className="group flex items-center gap-3 text-ink transition-colors hover:text-accent"
            >
              <Mail size={18} aria-hidden /> {CURSO.contacto.email}
            </a>
            <a
              href={CURSO.contacto.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 text-ink transition-colors hover:text-accent"
            >
              <Instagram size={18} aria-hidden /> @{CURSO.contacto.instagram}
            </a>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line/10 pt-6 text-sm text-text/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Teatranding!</p>
          <a href="#aviso-de-privacidad" className="underline-offset-4 hover:text-accent hover:underline">
            Aviso de privacidad
          </a>
        </div>
      </div>
    </footer>
  );
}
