import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { CURSO } from '../content/curso';

/**
 * Aviso de privacidad integral (borrador genérico).
 * Validar con asesoría legal antes de publicar.
 */
const RESPONSABLE = {
  nombre: 'Mauricio Baylón',
  marca: 'Teatranding!',
  domicilio:
    'Calle Tochtli, Manzana 9, Interior Lote 6, Colonia Pedregal de Santo Domingo, Alcaldía Coyoacán, C.P. 04369, Ciudad de México',
  email: CURSO.contacto.email,
};
const ULTIMA_ACTUALIZACION = '16 de octubre de 2026';

const H = ({ children }: { children: ReactNode }) => (
  <h3 className="mt-8 font-display text-lg font-semibold uppercase tracking-[0.12em] text-ink first:mt-0">{children}</h3>
);
const P = ({ children }: { children: ReactNode }) => <p className="mt-3">{children}</p>;
const UL = ({ children }: { children: ReactNode }) => <ul className="mt-3 list-disc space-y-1.5 pl-5">{children}</ul>;

export default function AvisoPrivacidad() {
  const [open, setOpen] = useState(false);

  // Open automatically when someone follows a link to #aviso-de-privacidad
  useEffect(() => {
    const check = () => {
      if (window.location.hash === '#aviso-de-privacidad') setOpen(true);
    };
    check();
    window.addEventListener('hashchange', check);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href="#aviso-de-privacidad"]');
      if (a) setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', check);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <section id="aviso-de-privacidad" className="py-16 sm:py-20">
      <div className="page">
        <div className="card mx-auto max-w-3xl overflow-hidden">
          <h2>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="aviso-contenido"
              className="flex w-full items-center gap-4 p-6 text-left sm:p-8"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                <ShieldCheck size={22} aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-xl font-bold text-ink sm:text-2xl">Aviso de privacidad</span>
                <span className="block text-sm text-text/70">
                  Cómo tratamos los datos que nos compartes en el formulario de inscripción.
                </span>
              </span>
              <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-ink">
                <ChevronDown size={22} aria-hidden />
              </motion.span>
            </button>
          </h2>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id="aviso-contenido"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="border-t border-line/10 px-6 pb-8 pt-6 text-[0.95rem] leading-relaxed text-text/90 sm:px-8">
                  <P>
                    En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares
                    (publicada en el Diario Oficial de la Federación el 20 de marzo de 2025) y demás normativa aplicable, se
                    emite el presente Aviso de privacidad.
                  </P>

                  <H>1. Identidad y domicilio del responsable</H>
                  <P>
                    {RESPONSABLE.nombre}, persona física que opera bajo el nombre comercial {RESPONSABLE.marca} (en adelante,
                    “el Responsable”), con domicilio en {RESPONSABLE.domicilio}, es responsable del tratamiento de tus datos
                    personales. Para cualquier asunto relacionado con este aviso puedes escribir a{' '}
                    <a className="font-semibold text-accent underline" href={`mailto:${RESPONSABLE.email}`}>
                      {RESPONSABLE.email}
                    </a>
                    .
                  </P>

                  <H>2. Datos personales que recabamos</H>
                  <P>A través del formulario de inscripción de este sitio recabamos los siguientes datos de identificación y contacto:</P>
                  <UL>
                    <li>Nombre(s) y apellidos.</li>
                    <li>Correo electrónico.</li>
                    <li>El motivo por el que te interesa el curso (texto libre).</li>
                    <li>Tus preferencias de consentimiento y la fecha en que las otorgaste.</li>
                  </UL>
                  <P>
                    No solicitamos datos personales sensibles. Te pedimos no incluirlos en el campo de texto libre. Si llegaras a
                    compartirlos, no serán utilizados para ninguna finalidad y se eliminarán cuando los detectemos.
                  </P>
                  <P>
                    Los datos de tu tarjeta se capturan y procesan directamente en la plataforma de pagos Clip, conforme a su
                    propio aviso de privacidad. El Responsable no recibe ni almacena los datos completos de tu tarjeta; únicamente
                    recibe la confirmación de la operación.
                  </P>

                  <H>3. Finalidades del tratamiento</H>
                  <P>
                    <strong className="text-ink">Finalidades primarias</strong>, necesarias para la relación que solicitas:
                  </P>
                  <UL>
                    <li>Registrar tu solicitud de inscripción al curso.</li>
                    <li>Identificar y confirmar tu pago.</li>
                    <li>Registrar tu asistencia a las sesiones y emitir tu reconocimiento de participación al concluir el curso.</li>
                    <li>Contactarte sobre tu inscripción, el pago y la logística del curso, incluido el acceso a las sesiones en línea.</li>
                    <li>Conocer tus intereses para adaptar los contenidos del curso.</li>
                    <li>Atender tus dudas, comentarios o aclaraciones.</li>
                  </UL>
                  <P>
                    <strong className="text-ink">Finalidades secundarias</strong>, que no son necesarias para la relación y
                    requieren tu consentimiento por separado:
                  </P>
                  <UL>
                    <li>Enviarte información sobre futuros cursos, talleres y actividades de {RESPONSABLE.marca}.</li>
                  </UL>
                  <P>
                    Puedes aceptar o rechazar las finalidades secundarias marcando o dejando sin marcar la casilla
                    correspondiente en el formulario. También puedes negarte o retirar tu consentimiento en cualquier momento
                    escribiendo a {RESPONSABLE.email}. Negarte no afecta tu inscripción.
                  </P>

                  <H>4. Proveedores que nos ayudan a tratar tus datos</H>
                  <P>
                    Para operar el curso utilizamos proveedores de servicios que tratan datos por cuenta del Responsable y bajo sus
                    instrucciones (personas encargadas), entre ellos:
                  </P>
                  <UL>
                    <li>Servicios de alojamiento web y base de datos, donde se guarda el registro del formulario.</li>
                    <li>Clip (PayClip), para generar tu link de pago y procesar el pago (le compartimos tu nombre y correo electrónico).</li>
                    <li>Zoom, para impartir las sesiones en línea.</li>
                    <li>Servicios de correo electrónico, para comunicarnos contigo.</li>
                    <li>Google (Hojas de cálculo de Google), para administrar la lista de inscripciones y pagos.</li>
                  </UL>
                  <P>Algunos de estos proveedores pueden almacenar información en servidores ubicados fuera de México.</P>

                  <H>5. Transferencias de datos</H>
                  <P>
                    No vendemos ni compartimos tus datos personales con terceros para sus propios fines. Solo podríamos
                    transferirlos sin tu consentimiento en los casos previstos por la ley, por ejemplo, para atender un
                    requerimiento fundado y motivado de una autoridad competente.
                  </P>

                  <H>6. Derechos ARCO</H>
                  <P>
                    Tienes derecho a conocer qué datos tenemos de ti y cómo los usamos (Acceso), a pedir su corrección si son
                    inexactos o incompletos (Rectificación), a solicitar que los eliminemos de nuestros registros (Cancelación) y a
                    oponerte a su uso para fines específicos (Oposición).
                  </P>
                  <P>Para ejercerlos, envía una solicitud a {RESPONSABLE.email} que incluya:</P>
                  <UL>
                    <li>Tu nombre y un medio para comunicarte la respuesta.</li>
                    <li>Un documento que acredite tu identidad o, en su caso, la de tu representante legal.</li>
                    <li>La descripción clara de los datos y del derecho que deseas ejercer.</li>
                    <li>Cualquier elemento o documento que facilite la localización de tus datos.</li>
                  </UL>
                  <P>Responderemos tu solicitud dentro de los plazos que establece la ley, por el mismo medio por el que la recibimos.</P>

                  <H>7. Revocación del consentimiento y limitación del uso</H>
                  <P>
                    Puedes revocar el consentimiento que nos otorgaste o pedirnos que limitemos el uso o divulgación de tus datos
                    escribiendo a {RESPONSABLE.email}. Ten en cuenta que, si revocas el consentimiento para las finalidades
                    primarias, es posible que no podamos continuar con tu inscripción.
                  </P>

                  <H>8. Cookies y tecnologías similares</H>
                  <P>
                    Este sitio no utiliza cookies de rastreo ni herramientas de analítica. Solo guarda en tu navegador tu
                    preferencia de tema (claro u oscuro), que no constituye un dato personal y puedes borrar desde la
                    configuración de tu navegador.
                  </P>

                  <H>9. Menores de edad</H>
                  <P>
                    Si eres menor de edad, la inscripción debe realizarla tu madre, padre o tutor, quien otorgará el
                    consentimiento correspondiente.
                  </P>

                  <H>10. Cambios a este aviso</H>
                  <P>
                    Cualquier modificación a este Aviso de privacidad se publicará en esta misma página, indicando la fecha de la
                    última actualización.
                  </P>

                  <H>11. Autoridad</H>
                  <P>
                    Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes acudir ante la
                    Secretaría Anticorrupción y Buen Gobierno, autoridad competente en la materia.
                  </P>

                  <p className="mt-8 border-t border-line/10 pt-4 text-sm text-text/70">
                    Última actualización: {ULTIMA_ACTUALIZACION}.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
