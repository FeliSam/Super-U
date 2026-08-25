export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

export const faqItems: FaqItem[] = [
  {
    id: '1',
    category: 'Commandes',
    question: 'Comment suivre ma commande ?',
    answer:
      'Ouvrez Profil ou Accueil, puis « Suivi de commande ». Vous y voyez l’état en temps réel et le créneau de livraison.',
  },
  {
    id: '2',
    category: 'Commandes',
    question: 'Puis-je modifier ou annuler une commande ?',
    answer:
      'Tant que le statut est « Confirmée » ou « Préparation », contactez l’assistance via Chat pour modifier le créneau ou annuler.',
  },
  {
    id: '3',
    category: 'Livraison',
    question: 'Quels sont les délais de livraison ?',
    answer:
      'À Dakar, la plupart des commandes sont livrées le jour même entre 10h et 20h selon le créneau choisi.',
  },
  {
    id: '4',
    category: 'Livraison',
    question: 'La livraison est-elle gratuite ?',
    answer:
      'La livraison est offerte dès 15 000 F d’achat. Sinon, des frais de 1 500 F s’appliquent. Les membres Or peuvent aussi l’échanger contre des points.',
  },
  {
    id: '5',
    category: 'Paiement',
    question: 'Quels moyens de paiement acceptez-vous ?',
    answer:
      'Orange Money, Wave, cartes bancaires et paiement à la livraison selon disponibilité du quartier.',
  },
  {
    id: '6',
    category: 'Fidélité',
    question: 'Comment gagner des points fidélité ?',
    answer:
      '1 F dépensé = 1 point. Présentez votre QR code en caisse ou sur l’app. Les bonus s’appliquent lors des campagnes promo.',
  },
  {
    id: '7',
    category: 'Compte',
    question: 'Comment changer mon adresse ?',
    answer:
      'Allez dans Profil → Adresses de livraison, puis ajoutez ou modifiez une adresse favorite.',
  },
];

export const contactChannels = [
  {
    id: 'chat',
    icon: 'message-circle' as const,
    title: 'Chat assistance',
    subtitle: 'Réponse en quelques minutes',
    action: 'chat' as const,
  },
  {
    id: 'phone',
    icon: 'phone' as const,
    title: 'Appeler',
    subtitle: '+221 33 000 00 00',
    action: 'tel' as const,
    value: 'tel:+221330000000',
  },
  {
    id: 'whatsapp',
    icon: 'message-square' as const,
    title: 'WhatsApp',
    subtitle: '+221 77 000 00 00',
    action: 'tel' as const,
    value: 'tel:+221770000000',
  },
  {
    id: 'email',
    icon: 'mail' as const,
    title: 'E-mail',
    subtitle: 'aide@marchedore.sn',
    action: 'mail' as const,
    value: 'mailto:aide@marchedore.sn',
  },
];

export const legalSections = [
  {
    id: 'cgu',
    title: 'Conditions générales d’utilisation',
    body: 'Marché Doré fournit un service de commande et de livraison de produits alimentaires à Dakar. En utilisant l’application, vous acceptez les présentes conditions, notamment les règles de commande, de paiement et de livraison.',
  },
  {
    id: 'privacy',
    title: 'Confidentialité',
    body: 'Nous collectons les informations nécessaires à la livraison (nom, téléphone, adresse) et au suivi de commande. Vos données ne sont pas revendues. Vous pouvez demander leur suppression via l’assistance.',
  },
  {
    id: 'payments',
    title: 'Paiements',
    body: 'Les paiements mobiles et cartes sont sécurisés par nos partenaires. Marché Doré ne stocke pas les numéros de carte complets sur vos appareils.',
  },
  {
    id: 'returns',
    title: 'Retours & remboursements',
    body: 'En cas de produit endommagé ou manquant, signalez-le dans les 24 h via le chat assistance avec une photo. Un remplacement ou un avoir est proposé selon le cas.',
  },
];
