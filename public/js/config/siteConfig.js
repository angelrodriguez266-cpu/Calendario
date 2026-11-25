export const siteConfig = {
  couple: {
    names: 'María y Ángel',
    monogram: 'M&A',
    subtitle: 'Una Navidad juntos',
  },
  hero: {
    eyebrow: 'Una historia de',
    title: 'María y Ángel',
    subtitle: 'Una Navidad juntos',
    description:
      '31 días, 31 pequeños detalles y una historia que sigue escribiéndose...',
    ctaLabel: 'Entrar a nuestra historia',
    /**
     * Para reemplazar por su fotografía real definitiva:
     * 1. Copia la fotografía dentro de `public/images/` (ej. `public/images/nuestra-foto.jpg`)
     * 2. Cambia `imageSrc` a `'/images/nuestra-foto.jpg'` y cambia `isTemporaryReference` a `false`.
     */
    imageSrc: '/images/Foto1.jpg',
    imageAlt: 'María y Ángel — Una Navidad juntos',
    isTemporaryReference: false,
    referenceNote: '',
  },
  privateAccess: {
    title: 'Esta historia es solamente nuestra',
    subtitle: 'Ingresa la clave especial para continuar.',
    placeholder: 'Ingresa la clave especial',
    submitLabel: 'Abrir',
    invalidPasswordMessage:
      'Esa clave no coincide con nuestro secreto. Inténtalo nuevamente con calma.',
    unconfiguredServerMessage:
      'El acceso privado está protegido en el servidor y aún requiere configurar CALENDAR_PASSWORD_HASH y SESSION_SECRET en .env.local.',
  },
  calendar: {
    title: 'Nuestro Calendario de Navidad',
    subtitle: '31 días para celebrar lo que nos une',
  },
};
