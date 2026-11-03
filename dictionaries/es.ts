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
  home: {
    stay: {
      label: "Por qué se quedan",
      title: ["Pensado en lo que", "de verdad le importa al chofer."],
      intro: "Le preguntamos a nuestros choferes por qué se quedan. Estas son sus respuestas, no las nuestras.",
      items: [
        { t: "Pago seguro", d: "Pago por milla, cada semana, cada jueves. Sin trucos en los pagos." },
        { t: "Rutas constantes", d: "Carga estable en rutas que llegas a conocer. La constancia es lo que hacemos mejor que las grandes compañías." },
        { t: "Sin tiempo de espera", d: "Cargas planeadas y un despachador que va adelantado, para que estés rodando y no esperando." },
        { t: "En casa a tiempo", d: "Llega a casa directo y temprano, no tarde. Tiempo en casa que puedes planear." },
      ],
    },
    pay: {
      label: "Pago y tiempo en casa",
      title: ["Pago semanal.", "Cada jueves."],
      intro: "Tu tarifa por milla se confirma en tu primera llamada con el reclutador, antes de que te comprometas a nada.",
      stats: [
        { n: 250, prefix: "$", suffix: "", k: "Pago por layover" },
        { n: 1000, prefix: "$", suffix: "", k: "Bono en cada aniversario de trabajo" },
        { n: 7, prefix: "", suffix: " días", k: "Periodo de pago: lunes a lunes" },
        { n: 24, prefix: "", suffix: "/7", k: "Despacho en inglés y español" },
      ],
    },
    equipment: {
      label: "El equipo",
      title: ["Camiones en los que", "da gusto vivir."],
      intro: "Peterbilt 579 y Freightliner Cascadia automáticos, listos para la vida real en la carretera.",
      specs: [
        { k: "Tractos", v: "Peterbilt 579 · Freightliner Cascadia" },
        { k: "Transmisión", v: "Automática" },
        { k: "Comodidad", v: "APU · Inversor · Refrigerador · Microondas" },
        { k: "Cámara", v: "Solo hacia el camino, sin cámara al chofer" },
        { k: "Tráiler", v: "Dry van de 53'" },
        { k: "Carga", v: "Electrónicos · Drop & hook + carga en vivo" },
      ],
      fleet: "camiones en la flota",
      since: "transportando desde",
    },
    lane: {
      label: "La ruta",
      title: ["De Nevada a Georgia,", "y de regreso a casa."],
      intro: "Nuestra ruta principal va del patio en Henderson a Georgia, con carga regional, dedicada y OTR en 48 estados. Sin Canadá ni México.",
    },
    jobs: {
      label: "Puestos abiertos",
      title: ["Elige tu asiento."],
      intro: "Solo o en equipo. OTR, regional o dedicado. Todo CDL-A, todo dry van de 53', todo desde Henderson, NV.",
      cta: "Aplica en 2 minutos",
    },
    steps: {
      label: "Cómo contratamos",
      title: ["De la aplicación", "a tu primera carga en unas dos semanas."],
      items: [
        { t: "Aplica en 2 minutos", d: "Un formulario corto con respuestas de un toque. Sin SSN ni papeleo todavía." },
        { t: "Ken te llama", d: "Nuestro reclutador te devuelve la llamada, normalmente en menos de una hora en horario de oficina." },
        { t: "Aplicación completa", d: "Crea tu cuenta de chofer y termina tu aplicación DOT en línea, a tu ritmo." },
        { t: "Orientación en Henderson", d: "Un día en el patio. Pagamos el viaje si vives lejos. Luego, tu primera carga." },
      ],
    },
    owners: {
      label: "Owner-operators",
      title: ["¿Tienes tu camión?", "Trabaja con nosotros."],
      intro: "Carga dry van constante, un despachador que contesta y una base en Las Vegas. Cuéntanos de tu camión y te explicamos el programa.",
      cta: "Info para owner-operators",
    },
    faq: { label: "Preguntas", title: ["Respuestas directas."], more: "Todas las preguntas" },
    final: { title: ["¿Listo para rodar?"], sub: "Dos minutos para aplicar. Una persona real te llama.", call: "O llama al" },
  },
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
