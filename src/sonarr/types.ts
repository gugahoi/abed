export type SonarrSearchResult = {
  title: string;
  year: number;
  tvdbId: number;
  imdbId?: string;
  overview?: string;
  network?: string;
  runtime?: number;
  status?: string;
  seriesType?: 'standard' | 'daily' | 'anime';
  titleSlug: string;
  seasons: Array<{ seasonNumber: number; monitored: boolean }>;
  images: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
};

export type SonarrQualityProfile = {
  id: number;
  name: string;
};

export type SonarrRootFolder = {
  id: number;
  path: string;
  freeSpace?: number;
};

export type SonarrSeries = {
  id: number;
  title: string;
  year: number;
  tvdbId: number;
  imdbId?: string;
  monitored: boolean;
  status: string;
  statistics?: {
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
  };
};

export type AddSeriesPayload = SonarrSearchResult & {
  qualityProfileId: number;
  rootFolderPath: string;
  monitored: boolean;
  seasonFolder: boolean;
  addOptions: {
    monitor: 'all' | 'future' | 'missing' | 'existing' | 'firstSeason' | 'lastSeason' | 'latestSeason' | 'pilot' | 'recent' | 'none';
    searchForMissingEpisodes: boolean;
    searchForCutoffUnmetEpisodes: boolean;
  };
};
