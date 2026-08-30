import { CourseLogo } from '@/components/CourseLogo';
import { Field, PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont } from '@/constants/theme';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { persistAuthToken, setAuthToken } from '@/lib/api/http';
import { opsRegister } from '@/lib/api/ops';
import { showToast } from '@/lib/toastBus';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const STEPS = ['Identité', 'Métier', 'Véhicule', 'Papiers', 'Domicile', 'Magasins'] as const;
const JOBS = [
  { id: 'ramasseur', title: 'Ramasseur', hint: 'Je prépare les paniers en magasin.' },
  { id: 'livreur', title: 'Livreur', hint: 'Je récupère les colis et je livre.' },
  { id: 'coursier', title: 'Coursier', hint: 'Les deux : ramassage et livraison.' },
] as const;
const VEHICLES = [
  { id: 'moto', title: 'Moto', hint: 'Le plus fluide en ville' },
  { id: 'tricycle', title: 'Tricycle', hint: 'Colis volumineux' },
  { id: 'voiture', title: 'Voiture', hint: 'Longue distance' },
  { id: 'velo', title: 'Vélo', hint: 'Courts trajets' },
] as const;
const STORES = [
  { id: 'su-aeroport', name: 'Super U Aéroport' },
  { id: 'su-akpakpa', name: 'Super U Akpakpa' },
  { id: 'su-ganhi', name: 'Super U Ganhi' },
  { id: 'su-calavi', name: 'Super U Calavi' },
];

export default function RegisterScreen() {
  const { applyStaff } = useStaffAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [job, setJob] = useState<(typeof JOBS)[number]['id']>('coursier');
  const [vehicle, setVehicle] = useState('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [ownsVehicle, setOwnsVehicle] = useState(true);
  const [idNumber, setIdNumber] = useState('');
  const [hasLicense, setHasLicense] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [residenceLine, setResidenceLine] = useState('');
  const [residenceCity, setResidenceCity] = useState('Cotonou');
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceRef, setInsuranceRef] = useState('');
  const [storeIds, setStoreIds] = useState<string[]>(['su-aeroport']);

  const toggleStore = (id: string) => {
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const next = () => {
    setError(null);
    if (step === 0 && (firstName.trim().length < 2 || lastName.trim().length < 2 || !email.includes('@') || password.length < 6)) {
      setError('Nom, e-mail et mot de passe (6 caractères min.) sont requis.');
      showToast({ title: 'Inscription', body: 'Nom, e-mail et mot de passe (6 caractères min.) sont requis.', tone: 'error' });
      return;
    }
    if (step < STEPS.length - 1) {
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
        vehicle,
        vehiclePlate,
        ownsVehicle,
        needsKit: !ownsVehicle,
        idNumber,
        hasLicense,
        licenseNumber,
        residenceLine,
        residenceCity,
        hasInsurance,
        insuranceRef,
        storeIds,
        job,
      });
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <CourseLogo width={160} style={{ alignSelf: 'center' }} />
        <Text style={styles.kicker}>Candidature CourseGO</Text>
        <Text style={styles.title}>{STEPS[step]}</Text>
        <View style={styles.dots}>
          {STEPS.map((label, i) => (
            <View key={label} style={[styles.dot, i <= step && styles.dotOn]} />
          ))}
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}

        {step === 0 ? (
          <View style={styles.block}>
            <Field label="PRÉNOM" value={firstName} onChangeText={setFirstName} placeholder="Bodouin" />
            <Field label="NOM" value={lastName} onChangeText={setLastName} placeholder="Dognon" />
            <Field label="E-MAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label="TÉLÉPHONE" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01 40 00 00 02" />
            <Field label="MOT DE PASSE" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.block}>
            <Text style={styles.hint}>Vous pourrez toujours aider en magasin ou en tournée selon ce choix.</Text>
            {JOBS.map((j) => (
              <Pressable key={j.id} style={[styles.card, job === j.id && styles.cardOn]} onPress={() => setJob(j.id)}>
                <Text style={styles.cardTitle}>{j.title}</Text>
                <Text style={styles.cardHint}>{j.hint}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.block}>
            <Text style={styles.hint}>Choisissez votre moyen. L’itinéraire et l’ETA s’adaptent (ville, feux, heure de pointe).</Text>
            {VEHICLES.map((v) => (
              <Pressable key={v.id} style={[styles.card, vehicle === v.id && styles.cardOn]} onPress={() => setVehicle(v.id)}>
                <Text style={styles.cardTitle}>{v.title}</Text>
                <Text style={styles.cardHint}>{v.hint}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.row} onPress={() => setOwnsVehicle((o) => !o)}>
              <Text style={styles.rowTxt}>{ownsVehicle ? 'J’ai mon véhicule' : 'Super U me fournit le matériel (casque, etc.)'}</Text>
            </Pressable>
            {ownsVehicle ? (
              <Field label="IMMATRICULATION" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="AB 1234 RB" />
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.block}>
            <Field label="N° PIÈCE D’IDENTITÉ" value={idNumber} onChangeText={setIdNumber} placeholder="NPI / CIP" />
            <Pressable style={styles.row} onPress={() => setHasLicense((o) => !o)}>
              <Text style={styles.rowTxt}>{hasLicense ? 'J’ai un permis de conduire' : 'Pas de permis (vélo / accompagné)'}</Text>
            </Pressable>
            {hasLicense ? (
              <Field label="N° PERMIS" value={licenseNumber} onChangeText={setLicenseNumber} />
            ) : null}
            <Text style={styles.hint}>Les photos (pièce, permis, selfie) pourront être ajoutées depuis Profil une fois connecté.</Text>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.block}>
            <Field label="ADRESSE DE RÉSIDENCE" value={residenceLine} onChangeText={setResidenceLine} placeholder="Rue, quartier" />
            <Field label="VILLE" value={residenceCity} onChangeText={setResidenceCity} />
            <Pressable style={styles.row} onPress={() => setHasInsurance((o) => !o)}>
              <Text style={styles.rowTxt}>{hasInsurance ? 'J’ai une assurance' : 'Pas d’assurance pour l’instant'}</Text>
            </Pressable>
            {hasInsurance ? <Field label="RÉF. ASSURANCE" value={insuranceRef} onChangeText={setInsuranceRef} /> : null}
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.block}>
            <Text style={styles.hint}>Vous voyez les courses des Super U affiliés. Vous ne prenez des colis que dans un magasin à la fois.</Text>
            {STORES.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.card, storeIds.includes(s.id) && styles.cardOn]}
                onPress={() => toggleStore(s.id)}>
                <Text style={styles.cardTitle}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <PillButton
          label={busy ? '…' : step === STEPS.length - 1 ? 'CRÉER MON COMPTE' : 'CONTINUER'}
          onPress={next}
          disabled={busy}
        />
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.back}>Retour</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>J’ai déjà un compte</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, gap: 14, paddingBottom: 48 },
  kicker: { ...bodyFont('700'), color: colors.teal, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 },
  title: { ...displayFont('900'), fontSize: 26, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.teal, width: 18 },
  block: { gap: 12 },
  hint: { ...bodyFont('400'), color: colors.muted, lineHeight: 20 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  cardTitle: { ...displayFont('800'), fontSize: 16 },
  cardHint: { ...bodyFont('400'), color: colors.muted, marginTop: 4 },
  row: { paddingVertical: 8 },
  rowTxt: { ...bodyFont('600'), color: colors.teal },
  err: { ...bodyFont('600'), color: colors.danger },
  back: { ...bodyFont('600'), color: colors.muted, textAlign: 'center', marginTop: 8 },
});
