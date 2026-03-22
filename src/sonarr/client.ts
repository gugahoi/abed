import { createLogger } from '../logger';
import type { SonarrSearchResult, SonarrQualityProfile, SonarrRootFolder, SonarrSeries, AddSeriesPayload } from './types';

const log = createLogger('sonarr');

export class SonarrClient {
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
      log.error('Sonarr API error', { method, path: safePath, status: response.status });
      throw new Error(`Sonarr API error ${response.status}: ${body}`);
    }
    return response.json() as Promise<T>;
  }

  async searchSeries(query: string): Promise<SonarrSearchResult[]> {
    return this.request<SonarrSearchResult[]>(`/series/lookup?term=${encodeURIComponent(query)}`);
  }

  async addSeries(series: SonarrSearchResult, qualityProfileId: number, rootFolderPath: string): Promise<SonarrSeries> {
    const payload: AddSeriesPayload = {
      ...series,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      seasonFolder: true,
      addOptions: {
        monitor: 'all',
        searchForMissingEpisodes: true,
        searchForCutoffUnmetEpisodes: false,
      },
    };
    return this.request<SonarrSeries>('/series', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async seriesExists(tvdbId: number): Promise<boolean> {
    const series = await this.request<SonarrSeries[]>(`/series?tvdbId=${tvdbId}`);
    return series.length > 0;
  }

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.request<SonarrQualityProfile[]>('/qualityprofile');
  }

  async getRootFolders(): Promise<SonarrRootFolder[]> {
    return this.request<SonarrRootFolder[]>('/rootfolder');
  }
}
