import { describe, it, expect } from 'bun:test';
import { getMoviePosterUrl, getTvPosterUrl } from '../../../src/core/helpers/posterUrl';
import type { RadarrSearchResult } from '../../../src/radarr/types';
import type { SonarrSearchResult } from '../../../src/sonarr/types';

describe('getMoviePosterUrl', () => {
  it('returns remotePoster when present', () => {
    const movie: RadarrSearchResult = {
      title: 'The Batman',
      year: 2022,
      tmdbId: 414906,
      titleSlug: 'the-batman',
      remotePoster: 'https://image.tmdb.org/t/p/original/poster.jpg',
      images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/fallback.jpg' }],
    };
    expect(getMoviePosterUrl(movie)).toBe('https://image.tmdb.org/t/p/original/poster.jpg');
  });

  it('falls back to images array when remotePoster is undefined', () => {
    const movie: RadarrSearchResult = {
      title: 'The Batman',
      year: 2022,
      tmdbId: 414906,
      titleSlug: 'the-batman',
      images: [{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/fallback.jpg' }],
    };
    expect(getMoviePosterUrl(movie)).toBe('https://image.tmdb.org/t/p/original/fallback.jpg');
  });

  it('returns null when no poster available', () => {
    const movie: RadarrSearchResult = {
      title: 'The Batman',
      year: 2022,
      tmdbId: 414906,
      titleSlug: 'the-batman',
      images: [{ coverType: 'fanart', remoteUrl: 'https://example.com/fanart.jpg' }],
    };
    expect(getMoviePosterUrl(movie)).toBeNull();
  });

  it('returns null when images array is empty and no remotePoster', () => {
    const movie: RadarrSearchResult = {
      title: 'The Batman',
      year: 2022,
      tmdbId: 414906,
      titleSlug: 'the-batman',
      images: [],
    };
    expect(getMoviePosterUrl(movie)).toBeNull();
  });
});

describe('getTvPosterUrl', () => {
  it('returns poster remoteUrl from images array', () => {
    const show: SonarrSearchResult = {
      title: 'Breaking Bad',
      year: 2008,
      tvdbId: 81189,
      titleSlug: 'breaking-bad',
      seasons: [{ seasonNumber: 1, monitored: true }],
      images: [
        { coverType: 'fanart', remoteUrl: 'https://example.com/fanart.jpg' },
        { coverType: 'poster', remoteUrl: 'https://example.com/poster.jpg' },
      ],
    };
    expect(getTvPosterUrl(show)).toBe('https://example.com/poster.jpg');
  });

  it('returns null when no poster image in array', () => {
    const show: SonarrSearchResult = {
      title: 'Breaking Bad',
      year: 2008,
      tvdbId: 81189,
      titleSlug: 'breaking-bad',
      seasons: [{ seasonNumber: 1, monitored: true }],
      images: [{ coverType: 'fanart', remoteUrl: 'https://example.com/fanart.jpg' }],
    };
    expect(getTvPosterUrl(show)).toBeNull();
  });

  it('returns null when images array is empty', () => {
    const show: SonarrSearchResult = {
      title: 'Breaking Bad',
      year: 2008,
      tvdbId: 81189,
      titleSlug: 'breaking-bad',
      seasons: [{ seasonNumber: 1, monitored: true }],
      images: [],
    };
    expect(getTvPosterUrl(show)).toBeNull();
  });
});
