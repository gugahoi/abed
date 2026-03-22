export type RadarrSearchResult = {
  title: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  overview?: string;
  remotePoster?: string;
  studio?: string;
  runtime?: number;
  titleSlug: string;
  images: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
};

export type RadarrQualityProfile = {
  id: number;
  name: string;
};

export type RadarrRootFolder = {
  id: number;
  path: string;
  freeSpace?: number;
};

export type RadarrMovie = {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  monitored: boolean;
  status: string;
};

export type AddMoviePayload = RadarrSearchResult & {
  qualityProfileId: number;
  rootFolderPath: string;
  monitored: boolean;
  minimumAvailability: 'announced' | 'inCinemas' | 'released';
  addOptions: {
    searchForMovie: boolean;
  };
};
