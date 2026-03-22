import { createLogger } from '../logger';
import type { RadarrSearchResult, RadarrQualityProfile, RadarrRootFolder, RadarrMovie, AddMoviePayload } from './types';

const log = createLogger('radarr');

export class RadarrClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v3${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      const method = options?.method ?? 'GET';
      const safePath = path.split('?')[0] ?? path;
      log.error('Radarr API error', { method, path: safePath, status: response.status });
      throw new Error(`Radarr API error ${response.status}: ${body}`);
    }
    return response.json() as Promise<T>;
  }

  async searchMovies(query: string): Promise<RadarrSearchResult[]> {
    return this.request<RadarrSearchResult[]>(`/movie/lookup?term=${encodeURIComponent(query)}`);
  }

  async addMovie(movie: RadarrSearchResult, qualityProfileId: number, rootFolderPath: string): Promise<RadarrMovie> {
    const payload: AddMoviePayload = {
      ...movie,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      minimumAvailability: 'released',
      addOptions: {
        searchForMovie: true,
      },
    };
    return this.request<RadarrMovie>('/movie', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async movieExists(tmdbId: number): Promise<boolean> {
    const movies = await this.request<RadarrMovie[]>('/movie');
    return movies.some(m => m.tmdbId === tmdbId);
  }

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    return this.request<RadarrQualityProfile[]>('/qualityProfile');
  }

  async getRootFolders(): Promise<RadarrRootFolder[]> {
    return this.request<RadarrRootFolder[]>('/rootFolder');
  }
}
