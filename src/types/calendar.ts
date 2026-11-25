export type DayUnlockState = 'locked' | 'today' | 'unlocked';

export type DayCardIconType =
  | 'pine'
  | 'gift'
  | 'heart'
  | 'letter'
  | 'sparkle'
  | 'star-christmas'
  | 'finale-crown';

export type SpecialMilestone = 'christmas' | 'finale' | null;

export type SurpriseContentType =
  | 'pending'
  | 'letter'
  | 'photo'
  | 'video'
  | 'audio'
  | 'coupon'
  | 'gallery'
  | 'mixed';

export interface SurpriseMediaAsset {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'pdf';
  /** Nombre del archivo dentro de `private-content/day-XX/` (nunca en `public/`) */
  filename: string;
  caption?: string;
  mimeType: string;
}

export interface DaySurpriseDefinition {
  day: number;
  dateLabel: string;
  cardIcon: DayCardIconType;
  specialMilestone: SpecialMilestone;
  /** Cambiar a `true` cuando agregues el contenido real de ese día */
  isConfigured: boolean;
  contentType: SurpriseContentType;
  title?: string;
  subtitle?: string;
  bodyParagraphs?: string[];
  signature?: string;
  mediaAssets?: SurpriseMediaAsset[];
}

export interface PublicDayCardDTO {
  day: number;
  dateLabel: string;
  state: DayUnlockState;
  cardIcon: DayCardIconType;
  specialMilestone: SpecialMilestone;
  isConfigured: boolean;
}

export interface BogotaClockSnapshot {
  serverTimestampMs: number;
  bogotaIso: string;
  formattedDateEs: string;
  formattedTimeEs: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  msUntilNextMidnight: number;
  calendarPhase: 'before_december' | 'december_active' | 'after_december';
  isDevSimulated: boolean;
}

export interface CalendarOverviewResponse {
  clock: BogotaClockSnapshot;
  days: PublicDayCardDTO[];
}

export interface UnlockedDayDetailDTO {
  day: number;
  dateLabel: string;
  state: Exclude<DayUnlockState, 'locked'>;
  specialMilestone: SpecialMilestone;
  isConfigured: boolean;
  contentType: SurpriseContentType;
  title?: string;
  subtitle?: string;
  bodyParagraphs?: string[];
  signature?: string;
  mediaUrls?: Array<{
    id: string;
    kind: SurpriseMediaAsset['kind'];
    url: string;
    caption?: string;
    mimeType: string;
  }>;
}
