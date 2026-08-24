import { CtaButton, IconCircle, Screen, Page } from '@/components/ui';
import { StarRating } from '@/components/StarRating';
import { colors } from '@/constants/theme';
import { useReviews } from '@/context/ReviewsContext';
import { getProduct } from '@/data/catalog';
import { buildRatingSummary, catalogReviewsForProduct, type Review } from '@/data/reviews';
import { MAX_REVIEW_IMAGES, pickReviewImages } from '@/lib/pickReviewImages';
import { Feather, Ionicons } from '@expo/vector-icons';
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
  View,
} from 'react-native';
function StarRow({
  rating,
  size = 16,
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
}) {
  return <StarRating rating={rating} size={size} interactive={interactive} onChange={onChange} />;
}

function ReviewImages({ images }: { images: ImageSourcePropType[] }) {
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
                <Feather name="check-circle" size={12} color={colors.green} />
                <Text style={styles.verifiedText}>Achat vérifié</Text>
              </View>
            ) : null}
          </View>
          <StarRow rating={review.rating} size={14} />
        </View>
        <Text style={styles.reviewDate}>{review.date}</Text>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
      {review.images?.length ? <ReviewImages images={review.images} /> : null}
    </View>
  );
}

export default function ProductReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const { reviewsForProduct, addReview } = useReviews();
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
        <Text style={{ padding: 20, color: colors.text }}>Produit introuvable</Text>
      </Screen>
    );
  }

  const maxCount = Math.max(...summary.counts, 1);

  const submitReview = () => {
    const comment = draftComment.trim();
    if (!comment || draftRating < 1) return;
    addReview({
      productId: product.id,
      author: 'Amina F.',
      rating: draftRating,
      comment,
      images: draftImages.length ? draftImages.map((uri) => ({ uri })) : undefined,
    });
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
          <View style={styles.header}>
            <IconCircle name="chevron-left" onPress={() => router.back()} />
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Avis clients</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {product.name}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.avg}>{displayAverage.toFixed(1)}</Text>
                <StarRow rating={displayAverage} size={18} />
                <Text style={styles.totalReviews}>{displayTotal} avis</Text>
              </View>
              <View style={styles.summaryRight}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = summary.counts[star - 1];
                  const width = summary.total > 0 ? `${(count / maxCount) * 100}%` : '0%';
                  return (
                    <View key={star} style={styles.barRow}>
                      <Text style={styles.barLabel}>{star}</Text>
                      <Feather name="star" size={12} color={colors.gold} />
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: width as `${number}%` }]} />
                      </View>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Pressable style={styles.writeToggle} onPress={() => setFormOpen((v) => !v)}>
              <Feather name="edit-3" size={18} color={colors.gold} />
              <Text style={styles.writeToggleText}>
                {formOpen ? 'Masquer le formulaire' : 'Écrire un avis'}
              </Text>
              <Feather name={formOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>

            {formOpen ? (
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>Votre note</Text>
                <StarRow rating={draftRating} size={28} interactive onChange={setDraftRating} />
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.draftImages}>
                  {draftImages.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.draftImageWrap}>
                      <Image source={{ uri }} style={styles.draftImage} resizeMode="cover" />
                      <Pressable style={styles.removeImage} onPress={() => removeDraftImage(index)} hitSlop={8}>
                        <Feather name="x" size={14} color={colors.white} />
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

            {submitted ? (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={18} color={colors.green} />
                <Text style={styles.successText}>Merci ! Votre avis a été publié.</Text>
              </View>
            ) : null}

            <Text style={styles.listTitle}>Tous les avis ({allReviews.length})</Text>
            <View style={styles.list}>
              {allReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Page>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerCenter: { alignItems: 'center', gap: 2, flex: 1 },
  headerSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 13, maxWidth: 240 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  summaryCard: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
  summaryLeft: { alignItems: 'center', gap: 6, minWidth: 88 },
  avg: { color: colors.text, fontSize: 36, fontWeight: '800', lineHeight: 40 },
  totalReviews: { color: colors.muted, fontSize: 13 },
  summaryRight: { flex: 1, gap: 6, justifyContent: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { color: colors.muted, fontSize: 12, width: 10, textAlign: 'right' },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  barCount: { color: colors.muted, fontSize: 11, width: 18, textAlign: 'right' },
  writeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  writeToggleText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  formCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  formLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.bg,
  },
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
    justifyContent: 'center',
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  photoHint: { color: colors.placeholder, fontSize: 12, marginTop: -4 },
  reviewImages: { gap: 8, paddingRight: 4 },
  reviewImage: { width: 96, height: 96, borderRadius: 14, backgroundColor: colors.border },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef6ef',
    borderRadius: 12,
    padding: 12,
  },
  successText: { color: colors.green, fontSize: 14, fontWeight: '600' },
  listTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  list: { gap: 10 },
  reviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  reviewHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  reviewMeta: { flex: 1, gap: 4 },
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reviewAuthor: { color: colors.text, fontSize: 15, fontWeight: '700' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: colors.green, fontSize: 11, fontWeight: '600' },
  reviewDate: { color: colors.placeholder, fontSize: 11 },
  reviewComment: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
