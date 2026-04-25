export type ResumeMode = 'pause' | 'stop';

export interface DelayConfig {
  minMs: number;
  maxMs: number;
}

export interface ScraperConfig {
  city: string;
  country: string;
  searchTerm: string;
  depth: number;
  locale: string;
  googleMapsUrl: string;
  headed: boolean;
  resumeMode: ResumeMode;
  outputCsvPath: string;
  summaryPath: string;
  statePath: string;
  browserProfileDir: string;
  navigationTimeoutMs: number;
  actionDelay: DelayConfig;
  resultScrollDelayMs: number;
  maxResultScrolls: number;
}

export interface RawScraperConfig
  extends Partial<Omit<ScraperConfig, 'depth' | 'resumeMode'>> {
  city?: string;
  cities?: string[];
  country?: string;
  searchTerm?: string;
  searchTerms?: string[];
  depth?: number;
  resumeMode?: string;
}

export interface Venue {
  name: string;
  url: string;
  address?: string;
}

export interface DeletedReviews {
  min: number;
  max: number;
  estimate: number;
  rawText: string;
}

export interface ScrapedVenue extends Venue {
  venueType: string;
  totalReviews: number | null;
  deletedReviewsMin: number;
  deletedReviewsMax: number;
  deletedReviewsEstimate: number;
  currentStarRating: number | null;
  percentageDeleted: number | null;
  realScoreIfDeletedAreOneStar: number | null;
  deletedReviewNotice: string | null;
  scrapedAt: string;
  status: 'ok' | 'partial' | 'failed';
  error?: string;
}

export interface ScraperState {
  runKey: string;
  discoveredVenues: Venue[];
  completedUrls: string[];
  failedUrls: string[];
  cursor: number;
  updatedAt: string;
}

export interface RunSummary {
  city: string;
  country: string;
  searchTerm: string;
  depth: number;
  outputCsvPath: string;
  statePath: string;
  summaryPath: string;
  discoveredVenues: number;
  completedVenues: number;
  failedVenues: number;
  csvRows: number;
  okRows: number;
  partialRows: number;
  failedRows: number;
  deletionNoticesFound: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}
