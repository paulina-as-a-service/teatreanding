import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ease, fadeUp, stagger } from './motion';

/** Reveals its children once when scrolled into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'li' | 'section';
}) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      variants={{
        hidden: fadeUp.hidden,
        show: { ...(fadeUp.show as object), transition: { duration: 0.7, ease, delay } },
      }}
    >
      {children}
    </Comp>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={stagger(0.1)}
      className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}
    >
      <motion.p variants={fadeUp} className="eyebrow">
        {eyebrow}
      </motion.p>
      <motion.h2
        variants={fadeUp}
        className="mt-3 font-sans text-3xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-5xl"
      >
        {title}
      </motion.h2>
      {intro && (
        <motion.p variants={fadeUp} className="mt-5 text-lg text-text/85">
          {intro}
        </motion.p>
      )}
    </motion.div>
  );
}

/**
 * Renders editable copy. Text starting with "BORRADOR:" or "PENDIENTE:" gets a visible badge
 * so unfinished copy is easy to spot before publishing.
 */
export function Copy({ text, className }: { text: string; className?: string }) {
  const match = text.match(/^(BORRADOR|PENDIENTE):\s*/);
  if (!match) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      <span className="mr-2 inline-block -translate-y-px rounded-full border border-dashed border-highlight/60 px-2 py-0.5 align-middle font-display text-[0.7rem] font-semibold uppercase tracking-widest text-highlight">
        {match[1] === 'BORRADOR' ? 'Borrador' : 'Pendiente'}
      </span>
      {text.slice(match[0].length)}
    </span>
  );
}
