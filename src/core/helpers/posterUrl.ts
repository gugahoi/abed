import type { RadarrSearchResult } from '../../radarr/types';
import type { SonarrSearchResult } from '../../sonarr/types';

export function getMoviePosterUrl(movie: RadarrSearchResult): string | null {
  if (movie.remotePoster) return movie.remotePoster;
  const posterImage = movie.images.find(img => img.coverType === 'poster');
  return posterImage?.remoteUrl ?? null;
}

export function getTvPosterUrl(show: SonarrSearchResult): string | null {
  const posterImage = show.images.find(img => img.coverType === 'poster');
  return posterImage?.remoteUrl ?? null;
}
