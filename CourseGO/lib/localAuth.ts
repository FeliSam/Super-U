import type { Staff } from '@/lib/api/ops';

/** Préfixe jeton hors-ligne (pas un JWT serveur). */
export const LOCAL_OFFLINE_TOKEN_PREFIX = 'local.offline.coursego.';

export function isLocalOfflineToken(token: string | null | undefined): boolean {
  return Boolean(token && token.startsWith(LOCAL_OFFLINE_TOKEN_PREFIX));
}

type LocalAccount = {
  passwords: string[];
  emails: string[];
  phones: string[];
  staff: Staff;
};

const LOCAL_ACCOUNTS: LocalAccount[] = [
  {
    emails: ['courier@marchedore.bj', 'coursier@marchedore.bj'],
    phones: ['0140000002', '140000002', '2290140000002'],
    passwords: ['marche2024'],
    staff: {
      id: 'local-courier',
      email: 'courier@marchedore.bj',
      phone: '01 40 00 00 02',
      firstName: 'Koffi',
      lastName: 'Mensah',
      role: 'courier',
      canPick: false,
      canDeliver: true,
      storeId: 'su-ganhi',
      vehicle: 'moto',
      photoUrl: null,
      ratingAvg: 4.8,
      ratingCount: 12,
      mustResetPassword: false,
      onboardStatus: 'active',
      profile: null,
    },
  },
  {
    emails: ['picker@marchedore.bj', 'preparateur@marchedore.bj'],
    phones: ['0140000001', '140000001', '2290140000001'],
    passwords: ['marche2024'],
    staff: {
      id: 'local-picker',
      email: 'picker@marchedore.bj',
      phone: '01 40 00 00 01',
      firstName: 'Amina',
      lastName: 'Sossa',
      role: 'picker',
      canPick: true,
      canDeliver: false,
      storeId: 'su-ganhi',
      vehicle: null,
      photoUrl: null,
      ratingAvg: 4.9,
      ratingCount: 8,
      mustResetPassword: false,
      onboardStatus: 'active',
      profile: null,
    },
  },
];

function digitsOnly(s: string) {
  return s.replace(/\D/g, '').replace(/^229/, '');
}

export function matchLocalStaff(identifier: string, password: string): Staff | null {
  const id = identifier.trim();
  const pwd = password;
  if (!id || !pwd) return null;

  for (const account of LOCAL_ACCOUNTS) {
    if (!account.passwords.includes(pwd)) continue;
    const email = id.includes('@') ? id.toLowerCase() : '';
    const phone = digitsOnly(id);
    const emailOk = email && account.emails.includes(email);
    const phoneOk = phone.length >= 8 && account.phones.some((p) => digitsOnly(p) === phone);
    if (emailOk || phoneOk) return { ...account.staff };
  }
  return null;
}

export function localOfflineTokenFor(staffId: string) {
  return `${LOCAL_OFFLINE_TOKEN_PREFIX}${staffId}`;
}
