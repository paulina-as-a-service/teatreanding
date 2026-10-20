/**
 * Ilustraciones de línea para cada módulo del temario.
 * Usan los tokens de color del tema, así que cambian solas entre modo claro y oscuro.
 */

const S = 'stroke-ink fill-none';
const W = { strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const W2 = { ...W, strokeWidth: 2 };

/** Módulo 1: boceto del concepto sobre un escenario (proscenio, telones y cenital). */
function ProcesoCreativo() {
  return (
    <>
      {/* Haz de luz */}
      <path d="M120 34 L78 168 L162 168 Z" className="fill-highlight/15 stroke-none" />
      <circle cx="120" cy="30" r="9" className="fill-accent stroke-none" />
      {/* Marco del proscenio */}
      <path d="M30 196 V64 Q30 44 50 44 H190 Q210 44 210 64 V196" className={S} {...W} />
      {/* Telones */}
      <path d="M30 56 Q52 92 44 132 Q40 164 56 196" className="fill-accent/15 stroke-accent" {...W2} />
      <path d="M210 56 Q188 92 196 132 Q200 164 184 196" className="fill-accent/15 stroke-accent" {...W2} />
      <path d="M30 60 Q75 78 120 60 Q165 78 210 60" className="fill-none stroke-highlight" {...W2} />
      {/* Piso y personaje en boceto */}
      <path d="M22 196 H218" className={S} {...W} />
      <path d="M70 182 H170" className="stroke-ink/40 fill-none" {...W2} strokeDasharray="6 7" />
      <circle cx="120" cy="128" r="10" className="stroke-ink fill-none" {...W2} strokeDasharray="4 5" />
      <path d="M120 140 V166 M108 150 H132 M120 166 L110 182 M120 166 L130 182" className="stroke-ink fill-none" {...W2} strokeDasharray="4 5" />
      {/* Lápiz */}
      <g transform="rotate(38 186 150)">
        <rect x="178" y="100" width="16" height="62" rx="3" className="fill-surface stroke-ink" {...W2} />
        <path d="M178 162 L186 180 L194 162" className="fill-highlight/30 stroke-ink" {...W2} />
        <path d="M178 110 H194" className="stroke-ink" {...W2} />
      </g>
    </>
  );
}

/** Módulo 2: cronograma con ruta crítica y hoja de presupuesto. */
function ProcesoAdministrativo() {
  const filas = [
    { x: 62, w: 52, critica: true },
    { x: 98, w: 40, critica: false },
    { x: 114, w: 46, critica: true },
    { x: 86, w: 30, critica: false },
    { x: 160, w: 36, critica: true },
  ];
  return (
    <>
      {/* Tablero del cronograma */}
      <rect x="22" y="34" width="190" height="150" rx="14" className="fill-surface stroke-ink" {...W} />
      <path d="M22 60 H212" className={S} {...W2} />
      {[62, 100, 138, 176].map((x) => (
        <path key={x} d={`M${x} 60 V184`} className="stroke-ink/15 fill-none" {...W2} />
      ))}
      {[40, 52].map((x, i) => (
        <circle key={i} cx={x} cy="47" r="4" className="fill-accent stroke-none" />
      ))}
      {filas.map((f, i) => (
        <g key={i}>
          <path d={`M34 ${80 + i * 22} H50`} className="stroke-ink/40 fill-none" {...W2} />
          <rect
            x={f.x}
            y={73 + i * 22}
            width={f.w}
            height="13"
            rx="6.5"
            className={f.critica ? 'fill-highlight stroke-none' : 'fill-accent/25 stroke-none'}
          />
        </g>
      ))}
      {/* Ruta crítica */}
      <path d="M114 86 L114 101 M160 130 L160 145" className="stroke-highlight fill-none" {...W2} strokeDasharray="3 4" />
      {/* Hoja de presupuesto */}
      <g transform="rotate(-6 170 178)">
        <path d="M138 140 H204 V214 L196 208 L188 214 L180 208 L172 214 L164 208 L156 214 L148 208 L138 214 Z" className="fill-surface stroke-ink" {...W} />
        <path d="M148 158 H178 M148 172 H186 M148 186 H170" className="stroke-ink/40 fill-none" {...W2} />
        <circle cx="190" cy="158" r="8" className="fill-accent stroke-none" />
        <path d="M190 153 V163 M187 155.5 Q190 153.5 193 155.5 Q190 158 187 160.5 Q190 162.5 193 160.5" className="stroke-surface fill-none" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </>
  );
}

/** Módulo 3: plano técnico del escenario (stage plot) con vara de luces y cotas. */
function ProcesoTecnico() {
  return (
    <>
      {/* Hoja de plano */}
      <rect x="22" y="22" width="196" height="196" rx="14" className="fill-surface stroke-ink" {...W} />
      <g className="stroke-accent/15 fill-none" strokeWidth={1}>
        {[52, 82, 112, 142, 172].map((p) => (
          <path key={`v${p}`} d={`M${p} 22 V218`} />
        ))}
        {[52, 82, 112, 142, 172].map((p) => (
          <path key={`h${p}`} d={`M22 ${p} H218`} />
        ))}
      </g>
      {/* Vara de luces */}
      <path d="M50 54 H190" className={S} {...W} />
      {[64, 92, 120, 148, 176].map((x) => (
        <path key={x} d={`M${x - 6} 58 H${x + 6} L${x + 4} 70 H${x - 4} Z`} className="fill-highlight stroke-none" />
      ))}
      {/* Escenario */}
      <path d="M44 84 H196 V160 Q120 176 44 160 Z" className="fill-accent/10 stroke-ink" {...W} />
      {/* Micrófonos y monitores */}
      {[78, 120, 162].map((x) => (
        <g key={x}>
          <circle cx={x} cy="120" r="6" className="fill-ink stroke-none" />
          <path d={`M${x - 9} 146 H${x + 9} L${x + 5} 138 H${x - 5} Z`} className="fill-accent stroke-none" />
        </g>
      ))}
      {/* Consola en sala */}
      <rect x="100" y="186" width="40" height="18" rx="4" className="fill-none stroke-ink" {...W2} />
      <path d="M108 195 H112 M118 195 H122 M128 195 H132" className="stroke-highlight" {...W2} />
      {/* Cota */}
      <path d="M44 76 H196" className="stroke-ink/50 fill-none" {...W2} strokeDasharray="2 5" />
      <path d="M44 72 V80 M196 72 V80" className="stroke-ink/50" {...W2} />
    </>
  );
}

/** Módulo 4: boleto de taquilla con talón y sello de liquidado. */
function Operacion() {
  return (
    <>
      <g transform="rotate(-8 120 120)">
        {/* Boleto */}
        <path
          d="M26 70 H214 V102 A14 14 0 0 0 214 130 V170 H26 V130 A14 14 0 0 0 26 102 Z"
          className="fill-surface stroke-ink"
          {...W}
        />
        <path d="M160 74 V166" className="stroke-ink/40 fill-none" {...W2} strokeDasharray="5 6" />
        {/* Datos de la función */}
        <rect x="42" y="88" width="62" height="10" rx="5" className="fill-accent stroke-none" />
        <path d="M42 114 H138 M42 130 H118" className="stroke-ink/40 fill-none" {...W2} />
        <path d="M42 150 H58 M66 150 H82 M90 150 H106" className="stroke-highlight" {...W} />
        {/* Talón: asiento */}
        <rect x="172" y="92" width="28" height="22" rx="5" className="fill-highlight/20 stroke-none" />
        <path d="M176 136 V156 M182 136 V156 M186 136 V156 M192 136 V156 M196 136 V156" className="stroke-ink" strokeWidth={2} />
      </g>
      {/* Sello */}
      <g transform="rotate(14 170 188)">
        <circle cx="170" cy="188" r="28" className="fill-accent stroke-none" />
        <circle cx="170" cy="188" r="22" className="fill-none stroke-surface" strokeWidth={1.6} strokeDasharray="3 3" />
        <path d="M159 188 L167 196 L182 180" className="stroke-surface fill-none" {...W} />
      </g>
    </>
  );
}

/** Módulo 5: carpeta de proyecto con pestañas y lista de entregables. */
function TallerProyectos() {
  return (
    <>
      {/* Hojas al fondo */}
      <rect x="54" y="28" width="132" height="120" rx="10" className="fill-accent/15 stroke-ink" {...W2} />
      <rect x="44" y="40" width="132" height="120" rx="10" className="fill-surface stroke-ink" {...W2} />
      {[64, 88, 112, 136].map((y, i) => (
        <g key={y}>
          <rect x="58" y={y - 8} width="14" height="14" rx="4" className={i < 3 ? 'fill-highlight stroke-none' : 'fill-none stroke-ink'} {...W2} />
          {i < 3 && <path d={`M61 ${y - 1} L64 ${y + 2} L69 ${y - 4}`} className="stroke-surface fill-none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          <path d={`M82 ${y - 1} H${150 - i * 10}`} className="stroke-ink/40 fill-none" {...W2} />
        </g>
      ))}
      {/* Carpeta */}
      <path d="M24 112 H82 L94 100 H214 V210 Q214 218 206 218 H32 Q24 218 24 210 Z" className="fill-accent/25 stroke-ink" {...W} />
      <path d="M24 126 H214 V210 Q214 218 206 218 H32 Q24 218 24 210 Z" className="fill-surface stroke-ink" {...W} />
      {/* Pestañas de color */}
      <rect x="40" y="150" width="46" height="10" rx="5" className="fill-accent stroke-none" />
      <rect x="40" y="170" width="70" height="8" rx="4" className="fill-ink/20 stroke-none" />
      <rect x="40" y="186" width="54" height="8" rx="4" className="fill-ink/20 stroke-none" />
      <circle cx="180" cy="178" r="18" className="fill-highlight stroke-none" />
      <path d="M180 168 V188 M170 178 H190" className="stroke-surface" {...W} />
    </>
  );
}

const ILUSTRACIONES: Record<string, () => JSX.Element> = {
  '01': ProcesoCreativo,
  '02': ProcesoAdministrativo,
  '03': ProcesoTecnico,
  '04': Operacion,
  '05': TallerProyectos,
};

export default function ModuloIlustracion({ numero, className }: { numero: string; className?: string }) {
  const Dibujo = ILUSTRACIONES[numero] ?? ProcesoCreativo;
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden focusable="false">
      <Dibujo />
    </svg>
  );
}
