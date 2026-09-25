import { CourseLogo } from '@/components/CourseLogo';
import { Field, IconBtn, PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius, shadow } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { persistAuthToken, setAuthToken } from '@/lib/api/http';
import { opsRegister } from '@/lib/api/ops';
import { AFFILIATE_STORES } from '@/lib/staffLabels';
import { showToast } from '@/lib/toastBus';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { authPaths, goBack } from '@/lib/navigation';
import { keyboardScrollProps, useKeyboardAvoidProps } from '@/lib/keyboardAvoid';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const STEPS = [
  { title: 'Identité', hint: 'Comment vous joindre et vous connecter.' },
  { title: 'Métier', hint: 'Ramassage, livraison, ou les deux.' },
  { title: 'Véhicule', hint: 'L’itinéraire et l’ETA s’adaptent à votre moyen.' },
  { title: 'Papiers', hint: 'Pièce et permis — les photos viendront dans Profil.' },
  { title: 'Domicile', hint: 'Votre résidence pour le dossier RH.' },
  { title: 'Magasins', hint: 'Les Super U dont vous verrez les courses.' },
] as const;

const JOBS: { id: 'ramasseur' | 'livreur' | 'coursier'; title: string; hint: string; icon: ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'ramasseur', title: 'Ramasseur', hint: 'Je prépare les paniers en magasin.', icon: 'package' },
  { id: 'livreur', title: 'Livreur', hint: 'Je récupère les colis et je livre.', icon: 'truck' },
  { id: 'coursier', title: 'Coursier', hint: 'Les deux : ramassage et livraison.', icon: 'layers' },
];

const VEHICLES: { id: string; title: string; hint: string; icon: ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'moto', title: 'Moto', hint: 'Le plus fluide en ville', icon: 'navigation' },
  { id: 'tricycle', title: 'Tricycle', hint: 'Colis volumineux', icon: 'box' },
  { id: 'voiture', title: 'Voiture', hint: 'Longue distance', icon: 'truck' },
  { id: 'velo', title: 'Vélo', hint: 'Courts trajets', icon: 'activity' },
];

function flowForJob(job: (typeof JOBS)[number]['id']) {
  return job === 'ramasseur' ? [0, 1, 3, 4, 5] : [0, 1, 2, 3, 4, 5];
}

const TEST = {
  firstName: 'Amina',
  lastName: 'Koudjo',
  email: 'amina.koudjo@marchedore.bj',
  phone: '+229 01 40 00 00 08',
  password: 'marche2024',
  vehiclePlate: 'AB 4281 RB',
  idNumber: 'CIP-BJ-1996-4410',
  licenseNumber: 'PC-BJ-2018-902',
  residenceLine: 'Rue 214, Fidjrossè',
  residenceCity: 'Cotonou',
  insuranceRef: 'NSIA-MOTO-7721',
};

export default function RegisterScreen() {
  const { applyStaff } = useStaffAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState(TEST.firstName);
  const [lastName, setLastName] = useState(TEST.lastName);
  const [email, setEmail] = useState(TEST.email);
  const [phone, setPhone] = useState(TEST.phone);
  const [password, setPassword] = useState(TEST.password);
  const [job, setJob] = useState<(typeof JOBS)[number]['id']>('coursier');
  const [vehicle, setVehicle] = useState('moto');
  const [vehiclePlate, setVehiclePlate] = useState(TEST.vehiclePlate);
  const [ownsVehicle, setOwnsVehicle] = useState(true);
  const [idNumber, setIdNumber] = useState(TEST.idNumber);
  const [hasLicense, setHasLicense] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState(TEST.licenseNumber);
  const [residenceLine, setResidenceLine] = useState(TEST.residenceLine);
  const [residenceCity, setResidenceCity] = useState(TEST.residenceCity);
  const [hasInsurance, setHasInsurance] = useState(true);
  const [insuranceRef, setInsuranceRef] = useState(TEST.insuranceRef);
  const [storeIds, setStoreIds] = useState<string[]>(['su-aeroport', 'su-akpakpa']);
  const prevJobRef = useRef(job);
  const flow = useMemo(() => flowForJob(job), [job]);
  const stepId = flow[step] ?? 0;
  const kav = useKeyboardAvoidProps();
  const pickerOnly = job === 'ramasseur';

  useEffect(() => {
    if (prevJobRef.current === job) return;
    const oldFlow = flowForJob(prevJobRef.current);
    const newFlow = flowForJob(job);
    setStep((s) => {
      const currentId = oldFlow[s] ?? 0;
      const nextIndex = newFlow.indexOf(currentId);
      return nextIndex >= 0 ? nextIndex : 0;
    });
    prevJobRef.current = job;
  }, [job]);

  const fillTest = () => {
    setFirstName(TEST.firstName);
    setLastName(TEST.lastName);
    setEmail(TEST.email);
    setPhone(TEST.phone);
    setPassword(TEST.password);
    setJob('coursier');
    setVehicle('moto');
    setVehiclePlate(TEST.vehiclePlate);
    setOwnsVehicle(true);
    setIdNumber(TEST.idNumber);
    setHasLicense(true);
    setLicenseNumber(TEST.licenseNumber);
    setResidenceLine(TEST.residenceLine);
    setResidenceCity(TEST.residenceCity);
    setHasInsurance(true);
    setInsuranceRef(TEST.insuranceRef);
    setStoreIds(['su-aeroport', 'su-akpakpa']);
    setError(null);
    showToast({ title: 'Exemple', body: 'Parcours prérempli (Amina Koudjo).', tone: 'success' });
  };

  const toggleStore = (id: string) => {
    setStoreIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((s) => s !== id);
      }
      return [...prev, id];
    });
  };

  const next = () => {
    setError(null);
    if (stepId === 0 && (firstName.trim().length < 2 || lastName.trim().length < 2 || !email.includes('@') || password.length < 6)) {
      setError('Nom, e-mail et mot de passe (6 caractères min.) sont requis.');
      showToast({ title: 'Inscription', body: 'Nom, e-mail et mot de passe (6 caractères min.) sont requis.', tone: 'error' });
      return;
    }
    if (stepId === 5 && !storeIds.length) {
      setError('Choisissez au moins un Super U.');
      return;
    }
    if (step < flow.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    void submit();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await opsRegister({
        firstName,
        lastName,
        email,
        phone,
        password,
        vehicle: pickerOnly ? 'pied' : vehicle,
        vehiclePlate: pickerOnly ? '' : vehiclePlate,
        ownsVehicle: pickerOnly ? false : ownsVehicle,
        needsKit: pickerOnly ? false : !ownsVehicle,
        idNumber,
        hasLicense: pickerOnly ? false : hasLicense,
        licenseNumber: pickerOnly ? '' : licenseNumber,
        residenceLine,
        residenceCity,
        hasInsurance: pickerOnly ? false : hasInsurance,
        insuranceRef: pickerOnly ? '' : insuranceRef,
        storeIds,
        job,
      });
      if (res.pending || !res.token) {
        // Compte créé mais pas encore validé : retour à la connexion avec un message clair.
        showToast({
          title: 'Compte en attente de validation',
          body: res.pending ? res.message : 'Votre compte doit être validé par l’équipe Super U.',
          tone: 'info',
          durationMs: 8000,
        });
        router.replace({ pathname: '/(auth)/login', params: { pending: '1' } });
        return;
      }
      await persistAuthToken(res.token);
      setAuthToken(res.token);
      applyStaff(res.staff);
      router.replace('/(auth)/welcome');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le compte.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView {...kav} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.body}
        {...keyboardScrollProps()}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.topBar}>
            <IconBtn name="arrow-left" size={38} onPress={() => goBack(authPaths.login)} />
          </View>
          <CourseLogo width={132} />
          <View style={styles.dots}>
            {flow.map((id, i) => (
              <View key={STEPS[id].title} style={[styles.dot, i < step && styles.dotDone, i === step && styles.dotOn]} />
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : null}

        {stepId === 0 ? (
          <View style={styles.card}>
            <Field compact label="PRÉNOM" value={firstName} onChangeText={setFirstName} placeholder="Amina" />
            <Field compact label="NOM" value={lastName} onChangeText={setLastName} placeholder="Koudjo" />
            <Field
              compact
              label="E-MAIL"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="amina.koudjo@marchedore.bj"
            />
            <Field compact label="TÉLÉPHONE" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+229 01 40 00 00 08" />
            <Field compact label="MOT DE PASSE" value={password} onChangeText={setPassword} secureTextEntry secureToggle />
          </View>
        ) : null}

        {stepId === 1 ? (
          <View style={styles.stack}>
            {JOBS.map((j) => {
              const on = job === j.id;
              return (
                <Pressable key={j.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => setJob(j.id)}>
                  <View style={[styles.choiceIcon, on && styles.choiceIconOn]}>
                    <Feather name={j.icon} size={16} color={on ? colors.white : colors.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>{j.title}</Text>
                    <Text style={styles.cardHint}>{j.hint}</Text>
                  </View>
                  {on ? <Feather name="check" size={16} color={colors.teal} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {stepId === 2 ? (
          <View style={styles.stack}>
            {VEHICLES.map((v) => {
              const on = vehicle === v.id;
              return (
                <Pressable key={v.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => setVehicle(v.id)}>
                  <View style={[styles.choiceIcon, on && styles.choiceIconOn]}>
                    <Feather name={v.icon} size={16} color={on ? colors.white : colors.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>{v.title}</Text>
                    <Text style={styles.cardHint}>{v.hint}</Text>
                  </View>
                  {on ? <Feather name="check" size={16} color={colors.teal} /> : null}
                </Pressable>
              );
            })}
            <Pressable style={styles.toggle} onPress={() => setOwnsVehicle((o) => !o)}>
              <Feather name={ownsVehicle ? 'check-square' : 'square'} size={16} color={colors.teal} />
              <Text style={styles.toggleTxt}>
                {ownsVehicle ? 'J’ai mon véhicule' : 'Super U me fournit le matériel'}
              </Text>
            </Pressable>
            {ownsVehicle ? (
              <View style={styles.card}>
                <Field compact label="IMMATRICULATION" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="AB 4281 RB" />
              </View>
            ) : null}
          </View>
        ) : null}

        {stepId === 3 ? (
          <View style={styles.card}>
            <Field compact label="N° PIÈCE D’IDENTITÉ" value={idNumber} onChangeText={setIdNumber} placeholder="CIP-BJ-1996-4410" />
            <Pressable style={styles.toggle} onPress={() => setHasLicense((o) => !o)}>
              <Feather name={hasLicense ? 'check-square' : 'square'} size={16} color={colors.teal} />
              <Text style={styles.toggleTxt}>
                {hasLicense ? 'J’ai un permis de conduire' : 'Pas de permis (vélo / accompagné)'}
              </Text>
            </Pressable>
            {hasLicense ? (
              <Field compact label="N° PERMIS" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="PC-BJ-2018-902" />
            ) : null}
          </View>
        ) : null}

        {stepId === 4 ? (
          <View style={styles.card}>
            <Field compact label="ADRESSE DE RÉSIDENCE" value={residenceLine} onChangeText={setResidenceLine} placeholder="Rue, quartier" />
            <Field compact label="VILLE" value={residenceCity} onChangeText={setResidenceCity} />
            <Pressable style={styles.toggle} onPress={() => setHasInsurance((o) => !o)}>
              <Feather name={hasInsurance ? 'check-square' : 'square'} size={16} color={colors.teal} />
              <Text style={styles.toggleTxt}>{hasInsurance ? 'J’ai une assurance' : 'Pas d’assurance pour l’instant'}</Text>
            </Pressable>
            {hasInsurance ? (
              <Field compact label="RÉF. ASSURANCE" value={insuranceRef} onChangeText={setInsuranceRef} />
            ) : null}
          </View>
        ) : null}

        {stepId === 5 ? (
          <View style={styles.stack}>
            {AFFILIATE_STORES.map((s) => {
              const on = storeIds.includes(s.id);
              return (
                <Pressable key={s.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => toggleStore(s.id)}>
                  <View style={[styles.choiceIcon, on && styles.choiceIconOn]}>
                    <Feather name="map-pin" size={16} color={on ? colors.white : colors.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, on && styles.cardTitleOn]}>{s.name}</Text>
                    <Text style={styles.cardHint}>
                      {s.address} · {s.city}
                    </Text>
                  </View>
                  {on ? <Feather name="check" size={16} color={colors.teal} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <PillButton
          compact
          label={busy ? '…' : step === flow.length - 1 ? 'CRÉER MON COMPTE' : 'CONTINUER'}
          onPress={next}
          disabled={busy}
        />

        <Pressable onPress={fillTest} style={styles.demo}>
          <Text style={styles.demoKicker}>Exemple prérempli</Text>
          <Text style={styles.demoTxt}>Amina Koudjo · {TEST.email}</Text>
        </Pressable>

        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.back}>Retour</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => goBack(authPaths.login)}>
            <Text style={styles.back}>J’ai déjà un compte</Text>
          </Pressable>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 10, paddingBottom: 36 },
  hero: { alignItems: 'center', gap: 8, paddingBottom: 2, position: 'relative' },
  topBar: { width: '100%', alignItems: 'flex-start', marginBottom: -2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.teal, opacity: 0.45 },
  dotOn: { backgroundColor: colors.teal, width: 18 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  stack: { gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  choiceOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  choiceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconOn: { backgroundColor: colors.teal },
  cardTitle: { ...displayFont('800'), fontSize: 15, color: colors.text },
  cardTitleOn: { color: colors.teal },
  cardHint: { ...bodyFont('400'), color: colors.muted, marginTop: 2, fontSize: 12, lineHeight: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingHorizontal: 2 },
  toggleTxt: { ...bodyFont('600'), color: colors.teal, flex: 1, fontSize: 13 },
  errBox: { backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 10 },
  err: { ...bodyFont('600'), color: colors.danger, fontSize: 12 },
  demo: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.tealSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 1,
  },
  demoKicker: { ...displayFont('800'), fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.teal },
  demoTxt: { ...bodyFont('600'), fontSize: 11, color: colors.muted },
  back: { ...bodyFont('700'), color: colors.muted, textAlign: 'center', marginTop: 0, fontSize: 13 },
});
