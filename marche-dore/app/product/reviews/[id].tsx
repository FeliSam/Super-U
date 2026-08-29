import { CtaButton, IconCircle, Page, Screen } from '@/components/ui';
import { StarRating } from '@/components/StarRating';
import { type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useOrders } from '@/context/OrdersContext';
import { useProfile } from '@/context/ProfileContext';
import { useReviews } from '@/context/ReviewsContext';
import { getProduct } from '@/data/catalog';
import { buildRatingSummary, catalogReviewsForProduct, type Review } from '@/data/reviews';
import { hasPurchasedProduct } from '@/lib/purchaseGate';
import { MAX_REVIEW_IMAGES, pickReviewImages } from '@/lib/pickReviewImages';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View } from 'react-native';

function ReviewImages({ images }: { images: ImageSourcePropType[] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!images.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewImages}>
      {images.map((source, index) => (
        <Image key={index} source={source} style={styles.reviewImage} resizeMode="cover" />
      ))}
    </ScrollView>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = review.author.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <View style={styles.reviewNameRow}>
            <Text style={styles.reviewAuthor}>{review.author}</Text>
            {review.verified ? (
              <View style={styles.verified}>
                <Feather name="check" size={10} color={colors.onAccent} />
              </View>
            ) : null}
          </View>
          <View style={styles.reviewStarsRow}>
            <StarRating rating={review.rating} size={13} />
            {review.verified ? <Text style={styles.verifiedText}>Achat vérifié</Text> : null}
          </View>
        </View>
        <Text style={styles.reviewDate}>{review.date}</Text>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
      {review.images?.length ? <ReviewImages images={review.images} /> : null}
    </View>
  );
}

export default function ProductReviewsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : Array.isArray(idParam) ? idParam[0] : undefined;
  const product = getProduct(id);
  const { orders } = useOrders();
  const { profile } = useProfile();
  const { reviewsForProduct, addReview, hasUserReviewedProduct } = useReviews();
  const canReview = Boolean(id && hasPurchasedProduct(orders, id));
  const alreadyReviewed = Boolean(id && hasUserReviewedProduct(id));
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pickingImages, setPickingImages] = useState(false);

  const allReviews = useMemo(() => {
    if (!id) return [];
    const catalog = catalogReviewsForProduct(id);
    const user = reviewsForProduct(id);
    return [...user, ...catalog];
  }, [id, reviewsForProduct]);

  const summary = useMemo(
    () => buildRatingSummary(allReviews, product?.rating ?? 4.8),
    [allReviews, product?.rating],
  );

  const displayTotal = summary.total || product?.reviews || 0;
  const displayAverage = summary.total > 0 ? summary.average : (product?.rating ?? 4.8);

  if (!product) {
    return (
      <Screen>
        <Page style={styles.flex}>
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Produit introuvable</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.missingLink}>Retour</Text>
            </Pressable>
          </View>
        </Page>
      </Screen>
    );
  }

  const maxCount = Math.max(...summary.counts, 1);

  const submitReview = () => {
    if (!canReview || alreadyReviewed) return;
    const comment = draftComment.trim();
    if (!comment || draftRating < 1) return;
    addReview({
      productId: product.id,
      author: `${profile.firstName} ${profile.lastName.charAt(0)}.`,
      rating: draftRating,
      comment,
      images: draftImages.length ? draftImages.map((uri) => ({ uri })) : undefined });
    setDraftComment('');
    setDraftRating(5);
    setDraftImages([]);
    setFormOpen(false);
    setSubmitted(true);
  };

  const addPhotos = async () => {
    if (pickingImages) return;
    const remaining = MAX_REVIEW_IMAGES - draftImages.length;
    if (remaining <= 0) return;

    setPickingImages(true);
    try {
      const picked = await pickReviewImages(remaining);
      if (!picked.length) return;
      setDraftImages((prev) => [...prev, ...picked].slice(0, MAX_REVIEW_IMAGES));
    } finally {
      setPickingImages(false);
    }
  };

  const removeDraftImage = (index: number) => {
    setDraftImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Screen>
      <Page style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <LinearGradient colors={['#f8e4c4', colors.cream, colors.bg]} style={styles.hero}>
            <View style={styles.header}>
              <IconCircle name="chevron-left" onPress={() => router.back()} variant="hero" />
              <View style={styles.headerCenter}>
                <Text style={styles.title}>Avis clients</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {product.name}
                </Text>
              </View>
              <View style={styles.headerSpacer} />
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.bodySheet}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.avg}>{displayAverage.toFixed(1)}</Text>
                  <StarRating rating={displayAverage} size={17} />
                  <Text style={styles.totalReviews}>
                    {displayTotal} avis {displayTotal > 1 ? 'clients' : 'client'}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRight}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = summary.counts[star - 1];
                    const width = summary.total > 0 ? `${(count / maxCount) * 100}%` : '0%';
                    return (
                      <View key={star} style={styles.barRow}>
                        <Text style={styles.barLabel}>{star}</Text>
                        <Ionicons name="star" size={11} color={colors.gold} />
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: width as `${number}%` }]} />
                        </View>
                        <Text style={styles.barCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {canReview && !alreadyReviewed && !submitted ? (
                <Pressable
                  style={[styles.writeToggle, formOpen && styles.writeToggleOpen]}
                  onPress={() => setFormOpen((v) => !v)}>
                  <View style={styles.writeIcon}>
                    <Feather name="edit-3" size={16} color={colors.gold} />
                  </View>
                  <View style={styles.writeTextBlock}>
                    <Text style={styles.writeToggleText}>
                      {formOpen ? 'Masquer le formulaire' : 'Écrire un avis'}
                    </Text>
                    <Text style={styles.writeHint}>Achat vérifié · partagez votre expérience</Text>
                  </View>
                  <Feather name={formOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                </Pressable>
              ) : null}

              {!canReview ? (
                <View style={styles.lockedBanner}>
                  <Feather name="lock" size={18} color={colors.muted} />
                  <View style={styles.lockedText}>
                    <Text style={styles.lockedTitle}>Avis réservés aux acheteurs</Text>
                    <Text style={styles.lockedSub}>
                      Commandez et recevez ce produit pour pouvoir laisser un avis.
                    </Text>
                  </View>
                </View>
              ) : null}

              {alreadyReviewed || submitted ? (
                <View style={styles.successBanner}>
                  <Feather name="check-circle" size={18} color={colors.green} />
                  <Text style={styles.successText}>Merci ! Votre avis a été publié.</Text>
                </View>
              ) : null}

              {formOpen && canReview && !alreadyReviewed ? (
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Votre note</Text>
                  <View style={styles.draftStars}>
                    <StarRating rating={draftRating} size={30} interactive onChange={setDraftRating} />
                    <Text style={styles.draftRatingLabel}>{draftRating}/5</Text>
                  </View>
                  <Text style={styles.formLabel}>Votre avis</Text>
                  <TextInput
                    value={draftComment}
                    onChangeText={setDraftComment}
                    placeholder="Partagez votre expérience avec ce produit…"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    style={styles.input}
                    textAlignVertical="top"
                  />
                  <Text style={styles.formLabel}>Photos (optionnel)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.draftImages}>
                    {draftImages.map((uri, index) => (
                      <View key={`${uri}-${index}`} style={styles.draftImageWrap}>
                        <Image source={{ uri }} style={styles.draftImage} resizeMode="cover" />
                        <Pressable style={styles.removeImage} onPress={() => removeDraftImage(index)} hitSlop={8}>
                          <Feather name="x" size={14} color={colors.onAccent} />
                        </Pressable>
                      </View>
                    ))}
                    {draftImages.length < MAX_REVIEW_IMAGES ? (
                      <Pressable style={styles.addPhoto} onPress={addPhotos} disabled={pickingImages}>
                        <Feather name="camera" size={22} color={colors.gold} />
                        <Text style={styles.addPhotoText}>
                          {pickingImages ? 'Chargement…' : 'Ajouter'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                  <Text style={styles.photoHint}>Jusqu’à {MAX_REVIEW_IMAGES} photos par avis</Text>
                  <CtaButton label="Publier mon avis" onPress={submitReview} />
                </View>
              ) : null}

              <View style={styles.listHead}>
                <Text style={styles.listTitle}>Tous les avis</Text>
                <View style={styles.listBadge}>
                  <Text style={styles.listBadgeText}>{allReviews.length}</Text>
                </View>
              </View>

              {allReviews.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="message-circle" size={28} color={colors.gold} />
                  <Text style={styles.emptyTitle}>Aucun avis pour le moment</Text>
                  <Text style={styles.emptyText}>Soyez le premier à partager votre expérience.</Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {allReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    paddingBottom: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8 },
  headerCenter: { alignItems: 'center', gap: 2, flex: 1 },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, maxWidth: 240, fontWeight: '500' },
  content: { paddingBottom: 36 },
  bodySheet: {
    marginTop: -8,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 14 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  missingTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  missingLink: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16 },
  summaryLeft: { alignItems: 'center', gap: 6, minWidth: 92 },
  avg: { color: colors.text, fontSize: 40, fontWeight: '800', lineHeight: 44 },
  totalReviews: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  summaryRight: { flex: 1, gap: 7, justifyContent: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barLabel: { color: colors.muted, fontSize: 12, width: 10, textAlign: 'right', fontWeight: '600' },
  barTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  barCount: { color: colors.muted, fontSize: 11, width: 16, textAlign: 'right', fontWeight: '600' },
  writeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12 },
  writeToggleOpen: { borderColor: colors.gold, backgroundColor: colors.selectSoft },
  writeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  writeTextBlock: { flex: 1, gap: 2 },
  writeToggleText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  writeHint: { color: colors.muted, fontSize: 12 },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.cream,
    borderRadius: 16,
    padding: 14 },
  lockedText: { flex: 1, gap: 4 },
  lockedTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lockedSub: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    gap: 12 },
  formLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  draftStars: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftRatingLabel: { color: colors.gold, fontSize: 15, fontWeight: '800' },
  input: {
    minHeight: 110,
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.bg },
  draftImages: { gap: 10, paddingVertical: 2 },
  draftImageWrap: { position: 'relative' },
  draftImage: { width: 88, height: 88, borderRadius: 14, backgroundColor: colors.border },
  removeImage: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(28,22,19,0.65)',
    alignItems: 'center',
    justifyContent: 'center' },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderStyle: 'dashed',
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4 },
  addPhotoText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  photoHint: { color: colors.placeholder, fontSize: 12, marginTop: -4 },
  reviewImages: { gap: 8, paddingRight: 4 },
  reviewImage: { width: 92, height: 92, borderRadius: 14, backgroundColor: colors.border },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    padding: 12 },
  successText: { color: colors.green, fontSize: 14, fontWeight: '600', flex: 1 },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  listTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  listBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7 },
  listBadgeText: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  list: { gap: 10 },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 28 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 10 },
  reviewHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center' },
  avatarText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  reviewMeta: { flex: 1, gap: 4 },
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewAuthor: { color: colors.text, fontSize: 15, fontWeight: '700' },
  verified: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center' },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedText: { color: colors.green, fontSize: 11, fontWeight: '600' },
  reviewDate: { color: colors.placeholder, fontSize: 11, fontWeight: '500' },
  reviewComment: { color: colors.muted, fontSize: 14, lineHeight: 21 } });
}
