import type { Dictionary } from "./en";

// Draft Spanish. Must be reviewed by a native speaker before launch (docs/plan/09).
const es: Dictionary = {
  meta: {
    title: "Global Runners Logistics — Trabajos de chofer CDL-A en Las Vegas, NV",
    description:
      "Contratamos choferes CDL-A solos y en equipo en Las Vegas y Henderson, NV. Dry van de 53', rutas constantes, pago semanal cada jueves y despacho 24/7 en inglés y español.",
  },
  nav: {
    drive: "Maneja",
    driveItems: {
      company: { label: "Choferes de compañía", hint: "Trabajos CDL-A solo y en equipo" },
      team: { label: "Choferes en equipo", hint: "Rutas OTR en equipo, NV a GA" },
      solo: { label: "Choferes solos", hint: "Regional y dedicado" },
      pay: { label: "Pago y tiempo en casa", hint: "Pago semanal, cada jueves" },
      requirements: { label: "Requisitos", hint: "Lo que necesitas para aplicar" },
    },
    ownerOperators: "Owner-operators",
    about: "Nosotros",
    locations: "Ubicaciones",
    contact: "Contacto",
    login: "Iniciar sesión",
    apply: "Aplica ahora",
    menu: "Menú",
    close: "Cerrar",
    call: "Llamar",
  },
  hero: {
    eyebrow: "Contratando CDL-A · Las Vegas, NV",
    titleLines: ["Tu camino.", "Tu futuro.", "Nuestra familia."],
    sub: "Maneja para una flota de Las Vegas que te mantiene en movimiento: rutas constantes, pago semanal, despacho 24/7 y tiempo en casa que puedes planear.",
    primary: "Aplica ahora",
    secondary: "Ver pago",
  },
  proof: [
    { k: "Carga nacional", v: "48 estados" },
    { k: "Rutas constantes", v: "NV ↔ GA" },
    { k: "Choferes con experiencia", v: "1 año+ CDL-A" },
    { k: "Despacho 24/7", v: "Inglés y español" },
  ],
  footer: {
    tagline: "Trabajos CDL-A solo y en equipo desde Las Vegas, Nevada. Transportando desde 2012.",
    columns: { drivers: "Choferes", company: "Compañía", legal: "Legal" },
    links: {
      jobs: "Puestos abiertos",
      apply: "Aplica ahora",
      pay: "Pago y tiempo en casa",
      requirements: "Requisitos",
      owners: "Owner-operators",
      about: "Nosotros",
      locations: "Ubicaciones",
      contact: "Contacto",
      faq: "Preguntas frecuentes",
      privacy: "Política de privacidad",
      terms: "Términos",
      sms: "Términos de SMS",
      eeo: "Igualdad de oportunidades",
    },
    office: "Oficina",
    yard: "Patio de camiones",
    hours: "Despacho 24/7 · Horario de oficina, hora del Pacífico",
    rights: "Todos los derechos reservados.",
  },
  stub: {
    soon: "Estamos construyendo esta página.",
    back: "Volver al inicio",
  },
};

export default es;
